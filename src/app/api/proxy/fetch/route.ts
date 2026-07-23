import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_UA, BASE_URL } from "@/lib/idlix-gate";

export async function POST(req: NextRequest) {
  try {
    const { url, method, body, headers } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const res = await fetch(url, {
      method: method || "GET",
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": BASE_URL,
        "Referer": `${BASE_URL}/`,
        ...headers,
      },
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Proxy request failed" }, { status: 500 });
  }
}
