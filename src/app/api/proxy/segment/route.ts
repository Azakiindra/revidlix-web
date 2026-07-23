import { NextRequest, NextResponse } from "next/server";
import { BASE_URL, DEFAULT_UA } from "@/lib/idlix-gate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const headers = {
      "User-Agent": DEFAULT_UA,
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Origin": BASE_URL,
      "Referer": `${BASE_URL}/`,
    };

    const res = await fetch(targetUrl, { headers, cache: "no-store" });
    if (!res.ok) {
      return new NextResponse(`Segment fetch failed: ${res.status}`, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "video/MP2T",
        "Content-Length": String(arrayBuffer.byteLength),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Error proxying segment", { status: 500 });
  }
}
