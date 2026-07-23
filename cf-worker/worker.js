/**
 * RevIDLIX Cloudflare Worker — CORS Proxy & Single-Request Resolver
 * Routes:
 *  - GET /resolve?url=<idlix_url>  → Resolves the stream in a single request (highly robust session matching)
 *  - /z2/* → z2.idlixku.com (CORS proxy)
 *  - /mp/* → e2e.majorplay.net (CORS proxy)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Origin,Referer,Cookie,X-Cookie,X-Z2-Cookie",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const Z2_BASE = "https://z2.idlixku.com";
const MP_BASE = "https://e2e.majorplay.net";

function targetFor(pathname) {
  if (pathname.startsWith("/z2/"))
    return { base: Z2_BASE, rest: pathname.slice(3) };
  if (pathname.startsWith("/mp/"))
    return { base: MP_BASE, rest: pathname.slice(3) };
  return null;
}

// Helper to parse IDLIX URL
function parseIdlixUrl(input) {
  const clean = input.trim().split("?")[0].replace(/\/+$/, "");

  const epMatch = clean.match(/\/(?:series|tv)\/([^\/]+)\/season\/(\d+)\/episode\/(\d+)/i);
  if (epMatch) {
    return {
      slug: epMatch[1],
      contentType: "episode",
      season: parseInt(epMatch[2], 10),
      episode: parseInt(epMatch[3], 10),
    };
  }

  if (clean.includes("/series/") || clean.includes("/tv/")) {
    const slug = clean.split("/").pop() || clean;
    return { slug, contentType: "series" };
  }

  const slug = clean.split("/").pop() || clean;
  return { slug, contentType: "movie" };
}

// Helper to resolve relative URLs in m3u8
function resolveRelativeUrl(pathStr, baseUrl) {
  if (pathStr.startsWith("http://") || pathStr.startsWith("https://")) {
    return pathStr;
  }
  if (pathStr.startsWith("/")) {
    try {
      const u = new URL(baseUrl);
      return `${u.protocol}//${u.host}${pathStr}`;
    } catch {
      return `${MP_BASE}${pathStr}`;
    }
  }
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf("/"));
  return `${baseDir}/${pathStr}`;
}

// Parse variants from master playlist
function parseVariantsFromMaster(masterText, baseUrl) {
  const lines = masterText.trim().split("\n");
  const variants = [];
  let audioUrl = null;

  for (const line of lines) {
    if (line.includes("#EXT-X-MEDIA:TYPE=AUDIO")) {
      const match = line.match(/URI="([^"]+)"/);
      if (match) {
        audioUrl = resolveRelativeUrl(match[1], baseUrl);
      }
    }
  }

  if (!masterText.includes("#EXT-X-STREAM-INF")) {
    return {
      variants: [
        {
          resolution: "Original",
          height: "Original",
          bandwidth: 0,
          url: baseUrl,
        },
      ],
      audioUrl,
    };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const resMatch = line.match(/RESOLUTION=([x\d]+)/);

      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      const resolution = resMatch ? resMatch[1] : "unknown";

      i++;
      while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) {
        i++;
      }

      if (i < lines.length) {
        const pathStr = lines[i].trim();
        const url = resolveRelativeUrl(pathStr, baseUrl);

        let height = "unknown";
        if (resolution.includes("x")) {
          height = `${resolution.split("x")[1]}p`;
        } else {
          if (bandwidth > 3500000) height = "1080p";
          else if (bandwidth > 1800000) height = "720p";
          else if (bandwidth > 900000) height = "480p";
          else height = "360p";
        }

        if (!variants.some((v) => v.url === url)) {
          variants.push({ resolution, height, bandwidth, url });
        }
      }
    }
    i++;
  }

  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return { variants, audioUrl };
}

// Single-request resolver executed entirely within Cloudflare Workers
async function handleResolve(targetUrl) {
  const parsed = parseIdlixUrl(targetUrl);
  const slug = parsed.slug;
  const contentType = parsed.contentType;
  const season = parsed.season;
  const episode = parsed.episode;

  let cookies = {};

  function parseCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(/,(?=[^;]*=)/);
    for (const part of parts) {
      const cookiePart = part.trim().split(';')[0];
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx > 0) {
        const key = cookiePart.substring(0, eqIdx).trim();
        const val = cookiePart.substring(eqIdx + 1).trim();
        cookies[key] = val;
      }
    }
  }

  function getCookieHeader() {
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async function callUpstream(url, method = "GET", body = null, isPlain = false) {
    const headers = {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: Z2_BASE,
      Referer: `${Z2_BASE}/`,
    };

    const cookieStr = getCookieHeader();
    if (cookieStr) headers["Cookie"] = cookieStr;

    if (body) {
      headers["Content-Type"] = isPlain ? "text/plain" : "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : null,
    });

    const setCookie = res.headers.get("Set-Cookie");
    if (setCookie) parseCookies(setCookie);

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    return { status: res.status, ok: res.ok, data: json, text };
  }

  // Step 1: Resolve UUID
  let uuid = null;
  if (contentType === "episode") {
    if (!season || !episode) throw new Error("Missing season or episode");
    const apiUrl = `${Z2_BASE}/api/series/${slug}/season/${season}`;
    const referer = `${Z2_BASE}/series/${slug}/season/${season}/episode/${episode}`;
    const epRes = await callUpstream(apiUrl);
    if (!epRes.ok || !epRes.data) throw new Error(`Failed to fetch episode list: status ${epRes.status}`);
    const episodes = epRes.data.season?.episodes || [];
    const epObj = episodes.find((e) => Number(e.episodeNumber) === Number(episode));
    uuid = epObj ? epObj.id : null;
  } else {
    const apiPath = contentType === "series" ? "/api/series" : "/api/movies";
    const apiUrl = `${Z2_BASE}${apiPath}/${slug}`;
    const movRes = await callUpstream(apiUrl);
    if (!movRes.ok || !movRes.data) throw new Error(`Failed to fetch movie info: status ${movRes.status}`);
    uuid = movRes.data.id || movRes.data.data?.id;
  }

  if (!uuid) throw new Error("UUID not resolved");

  // Step 2: Track View (non-blocking)
  try {
    await callUpstream(`${Z2_BASE}/api/views/track`, "POST", {
      contentType: contentType === "episode" ? "tv_series" : contentType,
      contentId: uuid,
      ...(contentType === "episode" ? { episodeId: uuid } : {}),
    });
  } catch {}

  // Step 3: Get Play Info
  const playInfoType = contentType === "episode" ? "episode" : "movie";
  const playUrl = `${Z2_BASE}/api/watch/play-info/${playInfoType}/${uuid}`;
  const playRes = await callUpstream(playUrl);
  if (!playRes.ok || !playRes.data) throw new Error(`Failed to get play info: status ${playRes.status}`);
  const playInfo = playRes.data;
  if (playInfo.kind !== "gate" || !playInfo.gateToken) {
    throw new Error("No valid gateToken in play info");
  }

  // Step 4: Wait Countdown
  const waitMs = Math.min(Math.max(0, playInfo.unlockAt - playInfo.serverNow + 500), 20000);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  // Step 5: Claim Session
  const claimRes = await callUpstream(`${Z2_BASE}/api/watch/session/claim`, "POST", {
    gateToken: playInfo.gateToken,
  });
  if (!claimRes.ok || !claimRes.data) throw new Error(`Claim failed: status ${claimRes.status} body ${claimRes.text}`);
  const claimData = claimRes.data;
  if (!claimData.claim || !claimData.redeemUrl) {
    throw new Error(`Claim parsing failed: ${claimRes.text}`);
  }

  // Step 6: Redeem Claim (majorplay.net)
  const redeemRes = await callUpstream(claimData.redeemUrl, "POST", JSON.stringify({ claim: claimData.claim }), true);
  if (!redeemRes.ok || !redeemRes.data) throw new Error(`Redeem failed: status ${redeemRes.status} body ${redeemRes.text}`);
  const playData = redeemRes.data;
  if (playData.code !== "ok" || !playData.url) {
    throw new Error(`Redeem response error: ${redeemRes.text}`);
  }

  const masterUrl = playData.url;

  // Step 7: Fetch Master M3U8 & Parse variants
  const m3u8Res = await callUpstream(masterUrl);
  if (!m3u8Res.ok) throw new Error(`Failed to fetch master m3u8: status ${m3u8Res.status}`);
  const { variants, audioUrl } = parseVariantsFromMaster(m3u8Res.text, masterUrl);

  const subtitles = (playData.subtitles || []).map((s) => ({
    lang: s.lang || "und",
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

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Special Route: /resolve
    if (url.pathname === "/resolve") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await handleResolve(targetUrl);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    const target = targetFor(url.pathname);
    if (!target) {
      return new Response(JSON.stringify({ error: "Unknown proxy path" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const destUrl = `${target.base}${target.rest}${url.search}`;

    // Build request headers — mimic a real browser on the same-origin site
    const fwdHeaders = {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Origin: target.base,
      Referer: `${target.base}/`,
      "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    };

    // Forward real client IP so z2.idlixku.com viewer session binds to user IP, not Worker edge IP
    const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For");
    if (clientIP) fwdHeaders["X-Forwarded-For"] = clientIP;

    const ct = request.headers.get("Content-Type");
    if (ct) fwdHeaders["Content-Type"] = ct;

    // Forward client cookies if sent
    const cookie = request.headers.get("Cookie") || request.headers.get("X-Cookie") || request.headers.get("X-Z2-Cookie");
    if (cookie) fwdHeaders["Cookie"] = cookie;

    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? request.body
        : undefined;

    const upstream = await fetch(destUrl, {
      method: request.method,
      headers: fwdHeaders,
      body,
    });

    const text = await upstream.text();

    const responseHeaders = {
      ...CORS,
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    };

    // Forward Set-Cookie
    const setCookie = upstream.headers.get("Set-Cookie");
    if (setCookie) {
      responseHeaders["Set-Cookie"] = setCookie;
      responseHeaders["X-Set-Cookie"] = setCookie;
    }

    // Forward all upstream headers for debugging
    for (const [key, val] of upstream.headers.entries()) {
      responseHeaders[`x-upstream-${key}`] = val;
    }

    return new Response(text, {
      status: upstream.status,
      headers: responseHeaders,
    });
  },
};
