// Test auth session establishment on z2.idlixku.com
// The IDLIX er() function calls /auth/me and /auth/refresh to establish session
// Maybe the claim requires a valid auth session (even as guest)

const CF_WORKER = 'https://revidlix-proxy.azaki3697.workers.dev';
const Z2 = 'https://z2.idlixku.com';
const SLUG = 'the-conjuring-2013';

const responseCookies = {};

function saveFromSetCookie(headers) {
  // Try to get set-cookie from response headers (if worker forwards them)
  // The worker currently strips set-cookie, but let's see what headers come back
  for (const [k, v] of headers.entries()) {
    if (k.toLowerCase() === 'set-cookie' || k.toLowerCase().startsWith('x-z2-')) {
      console.log(`  [Header] ${k}: ${v.slice(0, 100)}`);
    }
  }
}

async function wfetch(url, opts = {}) {
  const proxyUrl = url.startsWith(Z2) ? url.replace(Z2, `${CF_WORKER}/z2`) : url;
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://z2.idlixku.com',
    'Referer': 'https://z2.idlixku.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  };
  if (opts.body) headers['Content-Type'] = opts.contentType || 'application/json';
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  
  try {
    const res = await fetch(proxyUrl, {
      method: opts.method || 'GET',
      headers,
      body: opts.body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    saveFromSetCookie(res.headers);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, ok: res.ok, text, data, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Testing auth session + claim flow ===\n');
  
  // Step A: Try auth/me first (what IDLIX does on page load)
  console.log('Step A: GET /auth/me (establish session)...');
  const authMe = await wfetch(`${Z2}/api/auth/me`);
  console.log(`  Status: ${authMe.status}, body: ${authMe.text.slice(0, 150)}`);
  
  // Step B: Try auth/refresh bootstrap=0 (IDLIX calls this for guests)
  console.log('\nStep B: POST /auth/refresh?bootstrap=0...');
  const authRefresh = await wfetch(`${Z2}/api/auth/refresh?bootstrap=0`, {
    method: 'POST',
  });
  console.log(`  Status: ${authRefresh.status}, body: ${authRefresh.text.slice(0, 150)}`);
  
  // Now try the full flow
  console.log('\nStep 1: UUID...');
  const s1 = await wfetch(`${Z2}/api/movies/${SLUG}`);
  const uuid = s1.data?.id;
  console.log(`  Status: ${s1.status}, UUID: ${uuid}`);
  if (!uuid) return;
  
  console.log('\nStep 2: Track view...');
  const s2 = await wfetch(`${Z2}/api/views/track`, {
    method: 'POST',
    body: JSON.stringify({ contentType: 'movie', contentId: uuid }),
  });
  console.log(`  Status: ${s2.status}`);
  
  console.log('\nStep 3: Play-info...');
  const s3 = await wfetch(`${Z2}/api/watch/play-info/movie/${uuid}`);
  const playInfo = s3.data;
  console.log(`  Status: ${s3.status}, gateToken: ${!!playInfo?.gateToken}`);
  if (!playInfo?.gateToken) { console.error('No gateToken!'); return; }
  
  const waitMs = Math.min(Math.max(0, (playInfo.unlockAt ?? 0) - (playInfo.serverNow ?? 0) + 600), 20000);
  console.log(`\nStep 4: Waiting ${waitMs}ms...`);
  await sleep(waitMs);
  
  console.log('\nStep 5: Claim...');
  const s5 = await wfetch(`${Z2}/api/watch/session/claim`, {
    method: 'POST',
    body: JSON.stringify({ gateToken: playInfo.gateToken }),
  });
  console.log(`  Status: ${s5.status}`);
  console.log(`  Body: ${s5.text.slice(0, 300)}`);
  
  if (s5.data?.claim) {
    console.log('\n✅ CLAIM SUCCESS!');
    console.log(`  redeemUrl: ${s5.data.redeemUrl}`);
  } else {
    console.log('\n❌ CLAIM FAILED');
    
    // Try without waiting (immediate claim)
    console.log('\nStep 5b: Immediate claim (no countdown wait)...');
    const s3b = await wfetch(`${Z2}/api/watch/play-info/movie/${uuid}`);
    if (s3b.data?.gateToken) {
      const s5b = await wfetch(`${Z2}/api/watch/session/claim`, {
        method: 'POST',
        body: JSON.stringify({ gateToken: s3b.data.gateToken }),
      });
      console.log(`  Immediate claim status: ${s5b.status}, body: ${s5b.text.slice(0, 100)}`);
    }
  }
}

main().catch(console.error);
