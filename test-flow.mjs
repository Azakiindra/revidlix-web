/**
 * Test full IDLIX gate flow through CF Worker
 * Run: node test-flow.mjs
 */

const CF_WORKER = "https://revidlix-proxy.azaki3697.workers.dev";
const Z2 = "https://z2.idlixku.com";
const SLUG = "the-conjuring-2013";

const cookies = {};

function saveCookies(setCookieHeader) {
  if (!setCookieHeader) return;
  const parts = setCookieHeader.split(",");
  for (const part of parts) {
    const token = part.trim().split(";")[0].trim();
    const eq = token.indexOf("=");
    if (eq > 0) cookies[token.slice(0, eq).trim()] = token.slice(eq + 1).trim();
  }
}

function buildCookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function wfetch(url, opts = {}) {
  const proxyUrl = url.startsWith(Z2) ? url.replace(Z2, `${CF_WORKER}/z2`) : url;
  const headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": Z2,
    "Referer": `${Z2}/`,
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  };
  
  const cookieStr = buildCookieHeader();
  if (cookieStr) headers["Cookie"] = cookieStr;
  if (opts.body) headers["Content-Type"] = opts.contentType || "application/json";

  const res = await fetchWithTimeout(proxyUrl, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
  });

  // Track cookies from response
  const sc = res.headers.get("set-cookie");
  if (sc) saveCookies(sc);

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  
  return { status: res.status, ok: res.ok, text, data };
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("=== IDLIX Gate Flow Test ===\n");

  // Step 1: UUID
  console.log("Step 1: Getting UUID...");
  const s1 = await wfetch(`${Z2}/api/movies/${SLUG}`);
  const uuid = s1.data?.id;
  console.log(`  Status: ${s1.status}, UUID: ${uuid}`);
  if (!uuid) { console.error("  FAIL: No UUID"); process.exit(1); }

  // Step 2: Track View
  console.log("\nStep 2: Tracking view...");
  const s2 = await wfetch(`${Z2}/api/views/track`, {
    method: "POST",
    body: JSON.stringify({ contentType: "movie", contentId: uuid }),
  });
  console.log(`  Status: ${s2.status}, Response: ${s2.text.slice(0, 100)}`);
  console.log(`  Cookies so far: ${JSON.stringify(cookies)}`);

  // Step 3: Play Info
  console.log("\nStep 3: Getting play-info...");
  const s3 = await wfetch(`${Z2}/api/watch/play-info/movie/${uuid}`);
  const playInfo = s3.data;
  console.log(`  Status: ${s3.status}, Kind: ${playInfo?.kind}, hasGateToken: ${!!playInfo?.gateToken}`);
  console.log(`  gateToken prefix: ${playInfo?.gateToken?.slice(0, 50)}...`);
  console.log(`  serverNow: ${playInfo?.serverNow}, unlockAt: ${playInfo?.unlockAt}`);
  if (!playInfo?.gateToken) { console.error("  FAIL: No gateToken\n  Raw:", s3.text.slice(0, 300)); process.exit(1); }

  // Step 4: Wait
  const waitMs = Math.min(Math.max(0, (playInfo.unlockAt ?? 0) - (playInfo.serverNow ?? 0) + 600), 20000);
  console.log(`\nStep 4: Waiting ${waitMs}ms...`);
  await sleep(waitMs);

  // Step 5: Claim
  console.log("\nStep 5: Claiming session...");
  const s5 = await wfetch(`${Z2}/api/watch/session/claim`, {
    method: "POST",
    body: JSON.stringify({ gateToken: playInfo.gateToken }),
  });
  console.log(`  Status: ${s5.status}, hasClaim: ${!!s5.data?.claim}, hasRedeemUrl: ${!!s5.data?.redeemUrl}`);
  console.log(`  Raw: ${s5.text.slice(0, 300)}`);
  if (!s5.data?.claim) { console.error("  FAIL: No claim data"); process.exit(1); }

  // Step 6: Redeem
  console.log("\nStep 6: Redeeming...");
  const s6 = await wfetch(s5.data.redeemUrl, {
    method: "POST",
    body: JSON.stringify({ claim: s5.data.claim }),
    contentType: "text/plain",
  });
  console.log(`  Status: ${s6.status}, code: ${s6.data?.code}, hasUrl: ${!!s6.data?.url}`);
  console.log(`  masterUrl: ${s6.data?.url}`);
  
  if (s6.data?.code === "ok") {
    console.log("\n✅ SUCCESS! Full flow completed.");
  } else {
    console.log("\n❌ FAIL at redeem:", s6.text.slice(0, 300));
  }
}

main().catch(console.error);
