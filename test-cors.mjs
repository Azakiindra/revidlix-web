// Test CORS headers on z2.idlixku.com claim endpoint
// This simulates what a browser would do for a CORS preflight
async function main() {
  console.log('=== Testing CORS preflight to z2.idlixku.com/api/watch/session/claim ===\n');
  
  // Method 1: OPTIONS request directly to z2 via worker (to see upstream headers)
  // We need to update the worker to not intercept OPTIONS and forward instead
  // So test via PowerShell with curl

  // Method 2: Test claim with various Origin headers to see if any is allowed
  const origins = [
    'https://z2.idlixku.com',
    'https://idlix.to',
    'https://idlix.net', 
    null, // no origin
  ];
  
  for (const origin of origins) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    };
    if (origin) {
      headers['Origin'] = origin;
      headers['Referer'] = origin + '/';
    }
    
    try {
      // Test with a fake gateToken to see what error we get (not "Invalid CORS" but "Invalid token")
      const res = await fetch('https://revidlix-proxy.azaki3697.workers.dev/z2/api/watch/session/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gateToken: 'fake.test.token' }),
      });
      const text = await res.text();
      console.log(`Origin=${origin}: status=${res.status} body=${text.slice(0, 100)}`);
    } catch (e) {
      console.log(`Origin=${origin}: ERROR ${e.message}`);
    }
  }
  
  // Also check if there's a viewer token endpoint
  console.log('\n=== Testing viewer token endpoints ===');
  const endpoints = [
    '/api/watch/viewer-token',
    '/api/watch/session',
    '/api/auth/viewer',
    '/api/viewer',
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await fetch(`https://revidlix-proxy.azaki3697.workers.dev/z2${ep}`, {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://z2.idlixku.com',
        }
      });
      const text = await res.text();
      console.log(`${ep}: status=${res.status} body=${text.slice(0, 80)}`);
    } catch (e) {
      console.log(`${ep}: ERROR ${e.message}`);
    }
  }
}

main().catch(console.error);
