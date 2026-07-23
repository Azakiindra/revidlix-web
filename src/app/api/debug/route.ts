import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "the-conjuring-2013";
  const url = `https://z2.idlixku.com/api/movies/${slug}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://z2.idlixku.com",
        Referer: "https://z2.idlixku.com/",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    const text = await res.text();
    const isCloudflare =
      text.includes("Just a moment") ||
      text.includes("cf-browser-verification") ||
      text.includes("challenge-platform");

    return NextResponse.json({
      url,
      status: res.status,
      isCloudflareChallenge: isCloudflare,
      contentType: res.headers.get("content-type"),
      bodyPreview: text.slice(0, 300),
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, url }, { status: 500 });
  }
}
