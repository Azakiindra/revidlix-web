// Node 24 native fetch used

const CF_WORKER = 'https://revidlix-proxy.azaki3697.workers.dev';
const Z2 = 'https://z2.idlixku.com';
const SLUG = 'the-conjuring-2013';

let activeCookies = {};

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return;
  const parts = setCookieHeader.split(/,(?=[^;]*=)/);
  for (const part of parts) {
    const cookiePart = part.trim().split(';')[0];
    const eqIdx = cookiePart.indexOf('=');
    if (eqIdx > 0) {
      const key = cookiePart.substring(0, eqIdx).trim();
      const val = cookiePart.substring(eqIdx + 1).trim();
      activeCookies[key] = val;
    }
  }
}

function getCookieString() {
  return Object.entries(activeCookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function request(url, method = 'GET', body = null) {
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Origin': Z2,
    'Referer': `${Z2}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  const cookieStr = getCookieString();
  if (cookieStr) {
    headers['X-Cookie'] = cookieStr;
    console.log(`  -> Sending Cookie: ${cookieStr}`);
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const setCookie = res.headers.get('x-upstream-set-cookie') || res.headers.get('set-cookie');
  if (setCookie) {
    console.log(`  <- Set-Cookie: ${setCookie}`);
    parseCookies(setCookie);
  }

  const text = await res.text();
  let data = null;
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      data = JSON.parse(text);
    } catch {}
  }

  return { status: res.status, ok: res.ok, data, text, headers: res.headers };
}

async function main() {
  console.log('--- STARTING FLOW ---');
  
  console.log('\n[1] Fetching movie details to trigger initial cookies...');
  const r1 = await request(`${CF_WORKER}/z2/api/movies/${SLUG}`);
  console.log(`Status: ${r1.status}, UUID: ${r1.data?.id}`);
  const uuid = r1.data?.id;
  if (!uuid) {
    console.log('Failed to get UUID');
    return;
  }

  console.log('\n[2] Fetching view/track...');
  const r2 = await request(`${CF_WORKER}/z2/api/views/track`, 'POST', {
    contentType: 'movie',
    contentId: uuid,
  });
  console.log(`Status: ${r2.status}, body: ${r2.text}`);

  console.log('\n[3] Fetching play-info...');
  const r3 = await request(`${CF_WORKER}/z2/api/watch/play-info/movie/${uuid}`);
  console.log(`Status: ${r3.status}`);
  console.log(`Play info:`, r3.data);

  if (!r3.data?.gateToken) {
    console.log('No gateToken received');
    return;
  }

  const delay = Math.max(0, (r3.data.unlockAt - r3.data.serverNow) + 1000);
  console.log(`\nWaiting ${delay}ms for countdown...`);
  await new Promise(resolve => setTimeout(resolve, delay));

  console.log('\n[4] Claiming session...');
  const r4 = await request(`${CF_WORKER}/z2/api/watch/session/claim`, 'POST', {
    gateToken: r3.data.gateToken
  });
  console.log(`Status: ${r4.status}`);
  console.log(`Body: ${r4.text}`);
}

main().catch(console.error);
