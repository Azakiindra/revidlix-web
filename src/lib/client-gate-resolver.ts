/**
 * Client-Side Gate Resolver (Browser Engine)
 * All requests use same-origin /z2/ and /mp/ proxy paths via Vercel Edge Rewrites
 * → No CORS issues, no Cloudflare IP blocking
 */

import {
  BASE_URL,
  StreamDataResult,
  SubtitleTrack,
  parseIdlixUrl,
  parseVariantsFromMaster,
} from "./idlix-gate";

const Z2_BASE = "https://z2.idlixku.com";
const MP_BASE = "https://e2e.majorplay.net";

/** Convert full z2/mp URLs to same-origin proxy paths */
function toProxy(url: string): string {
  if (url.startsWith(Z2_BASE)) return url.replace(Z2_BASE, "/z2");
  if (url.startsWith(MP_BASE)) return url.replace(MP_BASE, "/mp");
  return url;
}

async function proxyFetch(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; text: string; data: any }> {
  const proxied = toProxy(url);

  try {
    const res = await fetch(proxied, {
      ...options,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        ...(options.headers || {}),
      },
      credentials: "omit",
    });

    const text = await res.text();
    let data: any = null;

    if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
      try {
        data = JSON.parse(text);
      } catch {}
    }

    const isChallenge =
      text.includes("Just a moment") ||
      text.includes("cf-browser-verification");

    return {
      ok: res.ok && !isChallenge,
      status: res.status,
      text,
      data,
    };
  } catch (err: any) {
    console.warn(`[proxyFetch error] ${proxied}:`, err.message);
    return { ok: false, status: 0, text: err.message || "", data: null };
  }
}

export async function executeClientSideGateFlow(
  inputUrlOrSlug: string,
  onProgress?: (step: number, message: string) => void
): Promise<StreamDataResult | null> {
  const inputTrim = inputUrlOrSlug.trim();
  const { slug, contentType, season, episode } = parseIdlixUrl(inputTrim);

  // Step 1: Resolve UUID
  if (onProgress) onProgress(1, "Resolving UUID via Edge Proxy...");
  let uuid: string | null = null;

  if (contentType === "episode") {
    if (!season || !episode) return null;
    const apiUrl = `${Z2_BASE}/api/series/${slug}/season/${season}`;
    const epRes = await proxyFetch(apiUrl, {
      headers: { Referer: `${BASE_URL}/series/${slug}/season/${season}/episode/${episode}` },
    });
    if (!epRes.data?.season) return null;
    const epObj = (epRes.data.season.episodes || []).find(
      (e: any) => Number(e.episodeNumber) === Number(episode)
    );
    uuid = epObj?.id ?? null;
  } else {
    const apiPath = contentType === "series" ? "/api/series" : "/api/movies";
    const apiUrl = `${Z2_BASE}${apiPath}/${slug}`;
    const movRes = await proxyFetch(apiUrl, {
      headers: { Referer: `${BASE_URL}/${contentType}/${slug}` },
    });
    if (!movRes.data) return null;
    uuid = movRes.data.id || movRes.data.data?.id || null;
  }

  if (!uuid) {
    console.error("[clientEngine] UUID not resolved for slug:", slug);
    return null;
  }

  // Step 2: Track View
  if (onProgress) onProgress(2, "Tracking view analytics...");
  await proxyFetch(`${Z2_BASE}/api/views/track`, {
    method: "POST",
    body: JSON.stringify({
      contentType: contentType === "episode" ? "tv_series" : contentType,
      contentId: uuid,
      ...(contentType === "episode" ? { episodeId: uuid } : {}),
    }),
    headers: {
      "Content-Type": "application/json",
      Referer: `${BASE_URL}/${contentType}/`,
    },
  });

  // Step 3: Get Play Info
  if (onProgress) onProgress(3, "Fetching play-info & gateToken...");
  const playInfoType = contentType === "episode" ? "episode" : "movie";
  const infoRes = await proxyFetch(
    `${Z2_BASE}/api/watch/play-info/${playInfoType}/${uuid}`,
    { headers: { Referer: `${BASE_URL}/${contentType}/` } }
  );

  if (!infoRes.data || infoRes.data.kind !== "gate" || !infoRes.data.gateToken) {
    console.error("[clientEngine] No valid gateToken:", infoRes.data);
    return null;
  }

  const playInfo = infoRes.data;

  // Step 4: Wait Countdown
  const waitMs = Math.min(
    Math.max(0, (playInfo.unlockAt ?? 0) - (playInfo.serverNow ?? 0) + 500),
    20000
  );
  if (onProgress) onProgress(4, `Waiting unlock (${(waitMs / 1000).toFixed(1)}s)...`);
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

  // Step 5: Claim Session JWT
  if (onProgress) onProgress(5, "Claiming session JWT...");
  const claimRes = await proxyFetch(`${Z2_BASE}/api/watch/session/claim`, {
    method: "POST",
    body: JSON.stringify({ gateToken: playInfo.gateToken }),
    headers: {
      "Content-Type": "application/json",
      Referer: `${BASE_URL}/${contentType}/`,
    },
  });

  if (!claimRes.data?.claim || !claimRes.data?.redeemUrl) {
    console.error("[clientEngine] Session claim failed:", claimRes.data);
    return null;
  }

  const claimData = claimRes.data;

  // Step 6: Redeem MajorPlay Stream
  if (onProgress) onProgress(6, "Redeeming MajorPlay stream...");
  const playRes = await proxyFetch(claimData.redeemUrl, {
    method: "POST",
    body: JSON.stringify({ claim: claimData.claim }),
    headers: {
      "Content-Type": "text/plain",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
    },
  });

  if (!playRes.data || playRes.data.code !== "ok" || !playRes.data.url) {
    console.error("[clientEngine] Redeem failed:", playRes.data);
    return null;
  }

  const playData = playRes.data;
  const masterUrl: string = playData.url;

  // Fetch Master M3U8 via proxy
  const m3u8Res = await fetch(
    `/api/proxy/m3u8?url=${encodeURIComponent(masterUrl)}`
  );
  if (!m3u8Res.ok) return null;

  const masterText = await m3u8Res.text();
  const { variants, audioUrl } = parseVariantsFromMaster(masterText, masterUrl);

  const subtitles: SubtitleTrack[] = (playData.subtitles || []).map(
    (s: any) => ({
      lang: s.lang || "und",
      label: s.label || "Subtitle",
      url: s.path,
    })
  );

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
}
