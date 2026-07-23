import {
  BASE_URL,
  DEFAULT_UA,
  StreamDataResult,
  SubtitleTrack,
  parseIdlixUrl,
  parseVariantsFromMaster,
} from "./idlix-gate";

async function browserFetch(
  url: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; text: string; data: any }> {
  const method = options.method || "GET";
  const reqHeaders: Record<string, string> = {
    "Accept": "application/json, text/plain, */*",
    ...options.headers,
  };

  let bodyStr: string | undefined = undefined;
  if (options.body) {
    bodyStr = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
  }

  // 1. Try Direct Browser Fetch first
  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: bodyStr,
      credentials: "omit",
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {}

    if (res.ok && !text.includes("<title>Just a moment...</title>")) {
      return { ok: true, status: res.status, text, data };
    }
  } catch (err) {
    console.warn("[browserFetch direct failed, trying proxy...]", err);
  }

  // 2. Fallback to /api/proxy/fetch server proxy
  try {
    const proxyRes = await fetch("/api/proxy/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        method,
        body: bodyStr,
        headers: reqHeaders,
      }),
    });

    const text = await proxyRes.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {}

    return {
      ok: proxyRes.ok && !text.includes("<title>Just a moment...</title>"),
      status: proxyRes.status,
      text,
      data,
    };
  } catch (err: any) {
    return { ok: false, status: 500, text: err.message || "", data: null };
  }
}

export async function executeClientSideGateFlow(
  inputUrlOrSlug: string,
  onProgress?: (step: number, message: string) => void
): Promise<StreamDataResult | null> {
  const inputTrim = inputUrlOrSlug.trim();
  const { slug, contentType, season, episode } = parseIdlixUrl(inputTrim);

  // Step 1: Resolve UUID
  if (onProgress) onProgress(1, "Resolving UUID in browser...");
  let uuid: string | null = null;

  if (contentType === "episode") {
    if (!season || !episode) return null;
    const apiUrl = `${BASE_URL}/api/series/${slug}/season/${season}`;
    const referer = `${BASE_URL}/series/${slug}/season/${season}/episode/${episode}`;
    const epRes = await browserFetch(apiUrl, { headers: { Referer: referer } });
    if (!epRes.data || !epRes.data.season) return null;

    const epObj = (epRes.data.season.episodes || []).find(
      (e: any) => Number(e.episodeNumber) === Number(episode)
    );
    uuid = epObj ? epObj.id : null;
  } else {
    const apiPath = contentType === "series" ? "/api/series" : "/api/movies";
    const apiUrl = `${BASE_URL}${apiPath}/${slug}`;
    const referer = `${BASE_URL}/${contentType}/${slug}`;
    const movRes = await browserFetch(apiUrl, { headers: { Referer: referer } });
    if (!movRes.data) return null;
    uuid = movRes.data.id || (movRes.data.data || {}).id || null;
  }

  if (!uuid) return null;

  // Step 2: Track View Analytics
  if (onProgress) onProgress(2, "Tracking view analytics...");
  const trackUrl = `${BASE_URL}/api/views/track`;
  const trackBody = {
    contentType: contentType === "episode" ? "tv_series" : contentType,
    contentId: uuid,
    ...(contentType === "episode" ? { episodeId: uuid } : {}),
  };
  await browserFetch(trackUrl, { method: "POST", body: trackBody, headers: { Referer: `${BASE_URL}/${contentType}/` } });

  // Step 3: Get Play Info
  if (onProgress) onProgress(3, "Requesting play-info & gateToken...");
  const playInfoType = contentType === "episode" ? "episode" : "movie";
  const playUrl = `${BASE_URL}/api/watch/play-info/${playInfoType}/${uuid}`;
  const infoRes = await browserFetch(playUrl, { headers: { Referer: `${BASE_URL}/${contentType}/` } });
  if (!infoRes.data || infoRes.data.kind !== "gate" || !infoRes.data.gateToken) return null;

  const playInfo = infoRes.data;

  // Step 4: Wait Unlock Countdown
  const waitMs = Math.min(Math.max(0, playInfo.unlockAt - playInfo.serverNow + 500), 20000);
  if (onProgress) onProgress(4, `Waiting unlock countdown (${(waitMs / 1000).toFixed(1)}s)...`);
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Step 5: Claim Session JWT
  if (onProgress) onProgress(5, "Claiming session JWT...");
  const claimUrl = `${BASE_URL}/api/watch/session/claim`;
  const claimRes = await browserFetch(claimUrl, {
    method: "POST",
    body: { gateToken: playInfo.gateToken },
    headers: { Referer: `${BASE_URL}/${contentType}/` },
  });

  if (!claimRes.data || !claimRes.data.claim || !claimRes.data.redeemUrl) return null;
  const claimData = claimRes.data;

  // Step 6: Redeem MajorPlay Stream
  if (onProgress) onProgress(6, "Redeeming MajorPlay stream...");
  const redeemUrl = claimData.redeemUrl;
  const playRes = await browserFetch(redeemUrl, {
    method: "POST",
    body: JSON.stringify({ claim: claimData.claim }),
    headers: { "Content-Type": "text/plain", Origin: BASE_URL, Referer: `${BASE_URL}/` },
  });

  if (!playRes.data || playRes.data.code !== "ok" || !playRes.data.url) return null;

  const playData = playRes.data;
  const masterUrl = playData.url;

  // Fetch Master M3U8 via proxy
  const m3u8ProxyUrl = `/api/proxy/m3u8?url=${encodeURIComponent(masterUrl)}`;
  const m3u8Res = await fetch(m3u8ProxyUrl);
  if (!m3u8Res.ok) return null;

  const masterText = await m3u8Res.text();
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
}
