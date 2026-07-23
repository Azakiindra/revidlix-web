import { gotScraping } from "got-scraping";
import { CookieJar } from "tough-cookie";
import {
  BASE_URL,
  DEFAULT_UA,
  StreamDataResult,
  SubtitleTrack,
  parseIdlixUrl,
  parseVariantsFromMaster,
} from "./idlix-gate";

function createHttpClient() {
  const cookieJar = new CookieJar();
  return gotScraping.extend({
    cookieJar,
    headers: {
      "User-Agent": DEFAULT_UA,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Origin": BASE_URL,
      "Referer": `${BASE_URL}/`,
    },
    timeout: {
      request: 25000,
    },
    retry: {
      limit: 2,
    },
  });
}

export async function fetchM3u8TextServer(url: string): Promise<string | null> {
  const client = createHttpClient();
  try {
    const res = await client.get(url);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.body;
    }
  } catch (err) {
    console.error(`[fetchM3u8TextServer Error] ${url}:`, err);
  }
  return null;
}

export async function resolveDirectM3u8Url(
  m3u8Url: string,
  title: string = "Direct M3U8 Stream"
): Promise<StreamDataResult | null> {
  const masterText = await fetchM3u8TextServer(m3u8Url);
  if (!masterText) return null;

  const { variants, audioUrl } = parseVariantsFromMaster(masterText, m3u8Url);

  return {
    title,
    videoId: null,
    durationSec: null,
    maxHeight: variants[0]?.height || null,
    expiresAt: null,
    masterUrl: m3u8Url,
    variants,
    audioPlaylistUrl: audioUrl,
    subtitles: [],
  };
}

export async function executeFullGateFlow(inputUrlOrSlug: string): Promise<StreamDataResult | null> {
  const inputTrim = inputUrlOrSlug.trim();

  // 1. Direct M3U8 URL check
  if (inputTrim.startsWith("http") && (inputTrim.includes(".m3u8") || inputTrim.includes("majorplay.net"))) {
    return await resolveDirectM3u8Url(inputTrim);
  }

  // 2. Direct GateToken JWT check
  if (!inputTrim.includes("/") && inputTrim.length > 50) {
    return await claimWithManualGateToken(inputTrim);
  }

  // 3. Full IDLIX URL or Slug Pipeline via 100% Pure JS/TS got-scraping Client
  const { slug, contentType, season, episode } = parseIdlixUrl(inputTrim);
  const client = createHttpClient();

  try {
    // Step 1: Resolve UUID
    let uuid: string | null = null;
    if (contentType === "episode") {
      if (!season || !episode) return null;
      const apiUrl = `${BASE_URL}/api/series/${slug}/season/${season}`;
      const referer = `${BASE_URL}/series/${slug}/season/${season}/episode/${episode}`;
      const epRes = await client.get(apiUrl, { headers: { Referer: referer } }).json<any>();
      const epObj = (epRes?.season?.episodes || []).find(
        (e: any) => Number(e.episodeNumber) === Number(episode)
      );
      uuid = epObj ? epObj.id : null;
    } else {
      const apiPath = contentType === "series" ? "/api/series" : "/api/movies";
      const apiUrl = `${BASE_URL}${apiPath}/${slug}`;
      const referer = `${BASE_URL}/${contentType}/${slug}`;
      const movRes = await client.get(apiUrl, { headers: { Referer: referer } }).json<any>();
      uuid = movRes?.id || (movRes?.data || {}).id || null;
    }

    if (!uuid) return null;

    // Step 2: Track View
    const trackUrl = `${BASE_URL}/api/views/track`;
    const trackBody = {
      contentType: contentType === "episode" ? "tv_series" : contentType,
      contentId: uuid,
      ...(contentType === "episode" ? { episodeId: uuid } : {}),
    };
    try {
      await client.post(trackUrl, { json: trackBody, headers: { Referer: `${BASE_URL}/${contentType}/` } });
    } catch {
      // analytics track failures non-fatal
    }

    // Step 3: Get Play Info
    const playInfoType = contentType === "episode" ? "episode" : "movie";
    const playUrl = `${BASE_URL}/api/watch/play-info/${playInfoType}/${uuid}`;
    const playInfo = await client.get(playUrl, { headers: { Referer: `${BASE_URL}/${contentType}/` } }).json<any>();

    if (!playInfo || playInfo.kind !== "gate") return null;

    // Step 4: Wait Countdown
    const waitMs = Math.min(Math.max(0, playInfo.unlockAt - playInfo.serverNow + 500), 20000);
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }

    // Step 5: Claim Session
    const claimUrl = `${BASE_URL}/api/watch/session/claim`;
    const claimData = await client
      .post(claimUrl, { json: { gateToken: playInfo.gateToken }, headers: { Referer: `${BASE_URL}/${contentType}/` } })
      .json<any>();

    if (!claimData || !claimData.claim || !claimData.redeemUrl) return null;

    // Step 6: Redeem Claim (majorplay.net)
    const redeemUrl = claimData.redeemUrl;
    const playData = await client
      .post(redeemUrl, {
        body: JSON.stringify({ claim: claimData.claim }),
        headers: { "Content-Type": "text/plain", Origin: BASE_URL, Referer: `${BASE_URL}/` },
      })
      .json<any>();

    if (!playData || playData.code !== "ok" || !playData.url) return null;

    const masterUrl = playData.url;

    // Fetch Master M3U8
    const masterRes = await client.get(masterUrl);
    if (!masterRes.body) return null;

    const masterText = masterRes.body;
    const { variants, audioUrl } = parseVariantsFromMaster(masterText, masterUrl);

    const subtitles: SubtitleTrack[] = (playData.subtitles || []).map((s: any) => ({
      lang: s.lang || "unknown",
      label: s.label || "Subtitle",
      url: s.path,
    }));

    return {
      title: claimData.title || slug,
      videoId: playData.videoId || claimData.videoId || null,
      durationSec: claimData.durationSec || null,
      maxHeight: playData.maxHeight || claimData.maxHeight || null,
      expiresAt: playData.expiresAt || null,
      masterUrl,
      variants,
      audioPlaylistUrl: audioUrl,
      subtitles,
    };
  } catch (err: any) {
    console.error("[executeFullGateFlow Pure JS Error]:", err);
    return null;
  }
}

export async function claimWithManualGateToken(
  gateToken: string,
  title: string = "Manual Gate Claim"
): Promise<StreamDataResult | null> {
  const client = createHttpClient();
  try {
    const claimUrl = `${BASE_URL}/api/watch/session/claim`;
    const claimData = await client
      .post(claimUrl, { json: { gateToken }, headers: { Referer: `${BASE_URL}/movie/` } })
      .json<any>();

    if (!claimData || !claimData.claim || !claimData.redeemUrl) return null;

    const redeemUrl = claimData.redeemUrl;
    const playData = await client
      .post(redeemUrl, {
        body: JSON.stringify({ claim: claimData.claim }),
        headers: { "Content-Type": "text/plain", Origin: BASE_URL, Referer: `${BASE_URL}/` },
      })
      .json<any>();

    if (!playData || playData.code !== "ok" || !playData.url) return null;

    const masterUrl = playData.url;
    const masterRes = await client.get(masterUrl);
    if (!masterRes.body) return null;

    const masterText = masterRes.body;
    const { variants, audioUrl } = parseVariantsFromMaster(masterText, masterUrl);

    const subtitles: SubtitleTrack[] = (playData.subtitles || []).map((s: any) => ({
      lang: s.lang || "unknown",
      label: s.label || "Subtitle",
      url: s.path,
    }));

    return {
      title: claimData.title || title,
      videoId: playData.videoId || claimData.videoId || null,
      durationSec: claimData.durationSec || null,
      maxHeight: playData.maxHeight || claimData.maxHeight || null,
      expiresAt: playData.expiresAt || null,
      masterUrl,
      variants,
      audioPlaylistUrl: audioUrl,
      subtitles,
    };
  } catch (err: any) {
    console.error("[claimWithManualGateToken Pure JS Error]:", err);
    return null;
  }
}
