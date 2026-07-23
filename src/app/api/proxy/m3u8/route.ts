import { NextRequest, NextResponse } from "next/server";
import { BASE_URL, DEFAULT_UA, fetchM3u8Text, resolveRelativeUrl } from "@/lib/idlix-gate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const text = await fetchM3u8Text(targetUrl);
    if (!text) {
      return new NextResponse("Failed to fetch M3U8 playlist", { status: 502 });
    }

    // Rewrite relative URLs to absolute CDN URLs or proxy segment URLs
    const lines = text.split("\n");
    const rewrittenLines: string[] = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#EXT-X-MAP:URI=")) {
        const match = trimmed.match(/URI="([^"]+)"/);
        if (match) {
          const absUrl = resolveRelativeUrl(match[1], targetUrl);
          const proxiedUrl = `/api/proxy/segment?url=${encodeURIComponent(absUrl)}`;
          rewrittenLines.push(trimmed.replace(match[1], proxiedUrl));
        } else {
          rewrittenLines.push(line);
        }
      } else if (trimmed.startsWith("#") || !trimmed) {
        rewrittenLines.push(line);
      } else {
        const absUrl = resolveRelativeUrl(trimmed, targetUrl);
        const proxiedUrl = `/api/proxy/segment?url=${encodeURIComponent(absUrl)}`;
        rewrittenLines.push(proxiedUrl);
      }
    }

    const body = rewrittenLines.join("\n");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Error proxying M3U8", { status: 500 });
  }
}
