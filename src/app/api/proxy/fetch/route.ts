import { NextRequest, NextResponse } from "next/server";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua":
    '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?1",
  "Sec-Ch-Ua-Platform": '"Android"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "X-Requested-With": "XMLHttpRequest",
};

function addCors(resp: NextResponse): NextResponse {
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return resp;
}

export async function OPTIONS() {
  return addCors(
    new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method = "GET", body: reqBody, headers: extraHeaders = {} } = body;

    if (!url || typeof url !== "string") {
      return addCors(
        NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
      );
    }

    // Merge all headers: browser defaults + caller overrides
    const mergedHeaders: Record<string, string> = {
      ...BROWSER_HEADERS,
      ...extraHeaders,
    };

    // Set correct Origin/Referer based on URL
    const urlObj = new URL(url);
    const origin = `${urlObj.protocol}//${urlObj.hostname}`;
    if (!extraHeaders["Origin"]) mergedHeaders["Origin"] = origin;
    if (!extraHeaders["Referer"]) mergedHeaders["Referer"] = `${origin}/`;

    let fetchBody: string | undefined = undefined;
    if (reqBody) {
      fetchBody = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: mergedHeaders,
        body: fetchBody,
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await res.text();

    // If Cloudflare challenge — treat as failure
    if (
      responseText.includes("<title>Just a moment") ||
      responseText.includes("cf-browser-verification") ||
      responseText.includes("challenge-platform")
    ) {
      return addCors(
        NextResponse.json(
          { error: "Cloudflare challenge – server IP is blocked" },
          { status: 403 }
        )
      );
    }

    return addCors(
      new NextResponse(responseText, {
        status: res.status,
        headers: {
          "Content-Type":
            res.headers.get("content-type") || "application/json",
        },
      })
    );
  } catch (err: any) {
    return addCors(
      NextResponse.json(
        { error: err.message || "Proxy request failed" },
        { status: 500 }
      )
    );
  }
}
