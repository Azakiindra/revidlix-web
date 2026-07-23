/**
 * IDLIX Gate Server Engine
 * 100% Pure Node.js built-in fetch (no got-scraping, no curl, no Python needed)
 * Works on Vercel, local dev, any Node 18+ environment
 */

import {
  BASE_URL,
  DEFAULT_UA,
  StreamDataResult,
  SubtitleTrack,
  parseIdlixUrl,
  parseVariantsFromMaster,
} from "./idlix-gate";

const Z2_BASE = "https://z2.idlixku.com";
const MP_BASE = "https://e2e.majorplay.net";

// If CF_PROXY_URL is set (e.g. https://my-worker.workers.dev),
// route all z2/mp requests through the Cloudflare Worker
const CF_PROXY = (process.env.CF_PROXY_URL || "").replace(/\/$/, "");

function toProxyUrl(url: string): string {
  if (CF_PROXY) {
    if (url.startsWith(Z2_BASE)) return `${CF_PROXY}/z2${url.slice(Z2_BASE.length)}`;
    if (url.startsWith(MP_BASE)) return `${CF_PROXY}/mp${url.slice(MP_BASE.length)}`;
  }
  return url; // direct (may fail on Vercel but keeps working locally)
}

// Shared cookie store (per-request, simple string map)
function makeFetcher() {
  const cookies: Record<string, string> = {};

  function buildCookieHeader(): string {
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  function saveCookies(setCookieHeader: string | null) {
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(",");
    for (const part of parts) {
      const token = part.trim().split(";")[0].trim();
      const eqIdx = token.indexOf("=");
      if (eqIdx > 0) {
        const key = token.slice(0, eqIdx).trim();
        const val = token.slice(eqIdx + 1).trim();
        if (key) cookies[key] = val;
      }
    }
  }

  async function apiFetch(
    url: string,
    options: {
      method?: "GET" | "POST";
      body?: string;
      referer?: string;
      contentType?: string;
      origin?: string;
    } = {}
  ): Promise<{ ok: boolean; status: number; text: string }> {
    const {
      method = "GET",
      body,
      referer = `${BASE_URL}/`,
      contentType = "application/json",
      origin = BASE_URL,
    } = options;

    const headers: Record<string, string> = {
      "User-Agent": DEFAULT_UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Origin: origin,
      Referer: referer,
      "Sec-Ch-Ua":
        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (body !== undefined) {
      headers["Content-Type"] = contentType;
    }

    const cookieStr = buildCookieHeader();
    if (cookieStr) headers["Cookie"] = cookieStr;

    const res = await fetch(toProxyUrl(url), {
      method,
      headers,
      body,
      redirect: "follow",
      // @ts-ignore — Node 18 supports this signal
      signal: AbortSignal.timeout(25000),
    });

    // Save cookies from response
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) saveCookies(setCookie);

    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  async function getJson<T = any>(
    url: string,
    referer?: string
  ): Promise<T | null> {
    const r = await apiFetch(url, { method: "GET", referer });
    if (!r.ok) return null;
    const trimmed = r.text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }

  async function postJson<T = any>(
    url: string,
    payload: unknown,
    options: { referer?: string; contentType?: string; origin?: string } = {}
  ): Promise<T | null> {
    const body =
      options.contentType === "text/plain"
        ? JSON.stringify(payload)
        : JSON.stringify(payload);
    const r = await apiFetch(url, {
      method: "POST",
      body,
      ...options,
    });
    if (!r.ok) return null;
    const trimmed = r.text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }

  return { getJson, postJson, apiFetch };
}

export async function fetchM3u8TextServer(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
      },
      // @ts-ignore
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("<title>Just a moment</title>")) return null;
    return text;
  } catch {
    return null;
  }
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

export async function executeFullGateFlow(
  inputUrlOrSlug: string
): Promise<StreamDataResult | null> {
  const inputTrim = inputUrlOrSlug.trim();

  // 1. Direct M3U8 URL
  if (
    inputTrim.startsWith("http") &&
    (inputTrim.includes(".m3u8") || inputTrim.includes("majorplay.net"))
  ) {
    return resolveDirectM3u8Url(inputTrim);
  }

  // 2. Direct GateToken JWT
  if (
    inputTrim.startsWith("ey") &&
    inputTrim.includes(".") &&
    inputTrim.length > 50
  ) {
    return claimWithManualGateToken(inputTrim);
  }

  // 3. Full IDLIX URL pipeline
  const { slug, contentType, season, episode } = parseIdlixUrl(inputTrim);
  const { getJson, postJson } = makeFetcher();

  try {
    // Step 1: Resolve UUID
    let uuid: string | null = null;
    if (contentType === "episode") {
      if (!season || !episode) return null;
      const apiUrl = `${BASE_URL}/api/series/${slug}/season/${season}`;
      const referer = `${BASE_URL}/series/${slug}/season/${season}/episode/${episode}`;
      const epRes = await getJson(apiUrl, referer);
      const epObj = (epRes?.season?.episodes || []).find(
        (e: any) => Number(e.episodeNumber) === Number(episode)
      );
      uuid = epObj ? epObj.id : null;
    } else {
      const apiPath = contentType === "series" ? "/api/series" : "/api/movies";
      const apiUrl = `${BASE_URL}${apiPath}/${slug}`;
      const referer = `${BASE_URL}/${contentType}/${slug}`;
      const movRes = await getJson(apiUrl, referer);
      uuid = movRes?.id || movRes?.data?.id || null;
    }

    if (!uuid) {
      console.error("[executeFullGateFlow] Could not resolve UUID for:", slug);
      return null;
    }

    // Step 2: Track View (non-fatal)
    try {
      await postJson(`${BASE_URL}/api/views/track`, {
        contentType: contentType === "episode" ? "tv_series" : contentType,
        contentId: uuid,
        ...(contentType === "episode" ? { episodeId: uuid } : {}),
      });
    } catch {}

    // Step 3: Get Play Info
    const playInfoType = contentType === "episode" ? "episode" : "movie";
    const playUrl = `${BASE_URL}/api/watch/play-info/${playInfoType}/${uuid}`;
    const playInfo = await getJson(playUrl, `${BASE_URL}/${contentType}/`);

    if (!playInfo || playInfo.kind !== "gate" || !playInfo.gateToken) {
      console.error("[executeFullGateFlow] No valid gateToken in play-info");
      return null;
    }

    // Step 4: Wait Countdown
    const waitMs = Math.min(
      Math.max(0, (playInfo.unlockAt ?? 0) - (playInfo.serverNow ?? 0) + 500),
      20000
    );
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

    // Step 5: Claim Session
    const claimData = await postJson(
      `${BASE_URL}/api/watch/session/claim`,
      { gateToken: playInfo.gateToken },
      { referer: `${BASE_URL}/${contentType}/` }
    );

    if (!claimData || !claimData.claim || !claimData.redeemUrl) {
      console.error("[executeFullGateFlow] Session claim failed");
      return null;
    }

    // Step 6: Redeem Claim
    const { getJson: _g, postJson: _p, apiFetch } = makeFetcher();
    const redeemRes = await apiFetch(claimData.redeemUrl, {
      method: "POST",
      body: JSON.stringify({ claim: claimData.claim }),
      contentType: "text/plain",
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
    });

    if (!redeemRes.ok) {
      console.error("[executeFullGateFlow] Redeem failed:", redeemRes.status);
      return null;
    }

    let playData: any;
    try {
      playData = JSON.parse(redeemRes.text);
    } catch {
      console.error("[executeFullGateFlow] Redeem response not JSON");
      return null;
    }

    if (playData.code !== "ok" || !playData.url) return null;

    const masterUrl: string = playData.url;

    // Fetch Master M3U8
    const masterText = await fetchM3u8TextServer(masterUrl);
    if (!masterText) {
      console.error("[executeFullGateFlow] M3U8 fetch failed or CF-blocked");
      return null;
    }

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
  } catch (err: any) {
    console.error("[executeFullGateFlow Error]:", err?.message || err);
    return null;
  }
}

export async function claimWithManualGateToken(
  gateToken: string,
  title: string = "Manual Gate Claim"
): Promise<StreamDataResult | null> {
  const { postJson, apiFetch } = makeFetcher();

  try {
    const claimData = await postJson(
      `${BASE_URL}/api/watch/session/claim`,
      { gateToken },
      { referer: `${BASE_URL}/movie/` }
    );

    if (!claimData || !claimData.claim || !claimData.redeemUrl) return null;

    const redeemRes = await apiFetch(claimData.redeemUrl, {
      method: "POST",
      body: JSON.stringify({ claim: claimData.claim }),
      contentType: "text/plain",
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
    });

    if (!redeemRes.ok) return null;

    let playData: any;
    try {
      playData = JSON.parse(redeemRes.text);
    } catch {
      return null;
    }

    if (playData.code !== "ok" || !playData.url) return null;

    const masterUrl: string = playData.url;
    const masterText = await fetchM3u8TextServer(masterUrl);
    if (!masterText) return null;

    const { variants, audioUrl } = parseVariantsFromMaster(masterText, masterUrl);
    const subtitles: SubtitleTrack[] = (playData.subtitles || []).map(
      (s: any) => ({
        lang: s.lang || "und",
        label: s.label || "Subtitle",
        url: s.path,
      })
    );

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
    console.error("[claimWithManualGateToken Error]:", err?.message || err);
    return null;
  }
}
