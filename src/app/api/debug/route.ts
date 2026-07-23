/**
 * Full Pipeline Debug Endpoint
 * Tests each step of the IDLIX gate flow and returns raw results
 */

import { NextRequest, NextResponse } from "next/server";

const CF_WORKER = "https://revidlix-proxy.azaki3697.workers.dev";
const Z2 = "https://z2.idlixku.com";

async function wfetch(
  url: string,
  opts: { method?: string; body?: string; contentType?: string } = {}
) {
  const proxyUrl = url.startsWith(Z2) ? url.replace(Z2, `${CF_WORKER}/z2`) : url;
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Origin: Z2,
    Referer: `${Z2}/`,
  };
  if (opts.body) headers["Content-Type"] = opts.contentType || "application/json";

  const res = await fetch(proxyUrl, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
    // @ts-ignore
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, text: text.slice(0, 500), data, ok: res.ok };
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "the-conjuring-2013";
  const log: any[] = [];

  try {
    // Step 1: UUID
    const step1 = await wfetch(`${Z2}/api/movies/${slug}`);
    const uuid = step1.data?.id;
    log.push({ step: "1_uuid", status: step1.status, uuid, preview: step1.text.slice(0, 120) });
    if (!uuid) return NextResponse.json({ log, error: "No UUID" });

    // Step 2: Play Info
    const step3 = await wfetch(`${Z2}/api/watch/play-info/movie/${uuid}`);
    const playInfo = step3.data;
    log.push({
      step: "3_playInfo",
      status: step3.status,
      kind: playInfo?.kind,
      hasGateToken: !!playInfo?.gateToken,
      gateTokenPrefix: playInfo?.gateToken?.slice(0, 30),
      unlockAt: playInfo?.unlockAt,
      serverNow: playInfo?.serverNow,
      preview: step3.text.slice(0, 200),
    });
    if (!playInfo?.gateToken) return NextResponse.json({ log, error: "No gateToken" });

    // Wait countdown
    const waitMs = Math.min(Math.max(0, (playInfo.unlockAt ?? 0) - (playInfo.serverNow ?? 0) + 500), 15000);
    log.push({ step: "4_wait", waitMs });
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

    // Step 5: Claim
    const step5 = await wfetch(`${Z2}/api/watch/session/claim`, {
      method: "POST",
      body: JSON.stringify({ gateToken: playInfo.gateToken }),
    });
    log.push({
      step: "5_claim",
      status: step5.status,
      ok: step5.ok,
      hasClaim: !!step5.data?.claim,
      hasRedeemUrl: !!step5.data?.redeemUrl,
      redeemUrl: step5.data?.redeemUrl,
      preview: step5.text.slice(0, 300),
    });
    if (!step5.data?.claim) return NextResponse.json({ log, error: "Claim failed" });

    // Step 6: Redeem
    const step6 = await wfetch(step5.data.redeemUrl, {
      method: "POST",
      body: JSON.stringify({ claim: step5.data.claim }),
      contentType: "text/plain",
    });
    log.push({
      step: "6_redeem",
      status: step6.status,
      code: step6.data?.code,
      hasUrl: !!step6.data?.url,
      preview: step6.text.slice(0, 300),
    });

    return NextResponse.json({ log, success: step6.data?.code === "ok", masterUrl: step6.data?.url });
  } catch (err: any) {
    return NextResponse.json({ log, error: err.message }, { status: 500 });
  }
}
