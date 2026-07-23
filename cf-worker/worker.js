/**
 * RevIDLIX Cloudflare Worker — CORS Proxy
 * Routes: /z2/* → z2.idlixku.com  |  /mp/* → e2e.majorplay.net
 * Deploy: paste this into Cloudflare Workers dashboard (workers.cloudflare.com)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Origin,Referer",
};

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

function targetFor(pathname) {
  if (pathname.startsWith("/z2/"))
    return { base: "https://z2.idlixku.com", rest: pathname.slice(3) };
  if (pathname.startsWith("/mp/"))
    return { base: "https://e2e.majorplay.net", rest: pathname.slice(3) };
  return null;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
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

    const ct = request.headers.get("Content-Type");
    if (ct) fwdHeaders["Content-Type"] = ct;

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

    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
