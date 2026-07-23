import { NextRequest, NextResponse } from "next/server";
import { convertVttToSrt } from "@/lib/subtitle-converter";
import { DEFAULT_UA } from "@/lib/idlix-gate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subUrl = searchParams.get("url");
    const format = searchParams.get("format") || "srt";
    const title = searchParams.get("title") || "subtitle";
    const label = searchParams.get("label") || "Sub";

    if (!subUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const res = await fetch(subUrl, {
      headers: { "User-Agent": DEFAULT_UA },
    });
    if (!res.ok) {
      return new NextResponse("Failed to fetch subtitle from CDN", { status: 502 });
    }

    const rawText = await res.text();
    let outputText = rawText;

    let filename = `${title.replace(/[\\/*?:"<>| ]/g, "_")}_${label}.${format}`;

    if (format === "srt") {
      outputText = convertVttToSrt(rawText);
    }

    return new NextResponse(outputText, {
      status: 200,
      headers: {
        "Content-Type": format === "srt" ? "text/plain; charset=utf-8" : "text/vtt; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Subtitle error", { status: 500 });
  }
}
