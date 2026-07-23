import { NextRequest, NextResponse } from "next/server";
import { executeFullGateFlow } from "@/lib/idlix-gate-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'url' parameter" }, { status: 400 });
    }

    const result = await executeFullGateFlow(url);
    if (!result) {
      return NextResponse.json(
        { error: "Failed to resolve stream. Check URL or content availability." },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Gate resolve error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
