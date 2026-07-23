// Deep search in the main bundle for er() function and auth headers
const URL = 'https://revidlix-proxy.azaki3697.workers.dev/z2/_next/static/chunks/33fdm48ajsn_y.js?dpl=20260722134309-d0a9efcb5024';

async function main() {
  const res = await fetch(URL);
  const text = await res.text();
  console.log('Chunk size:', text.length, 'chars');
  
  // Find "er" function definition around the watchApi usage
  // Look for the "watchApi" context more broadly
  const watchIdx = text.indexOf('"watchApi"');
  if (watchIdx >= 0) {
    console.log('\n=== watchApi context (large) ===');
    console.log(text.slice(Math.max(0, watchIdx - 2000), watchIdx + 3000));
  }
  
  // Look for Authorization header usage
  const authMatches = [...text.matchAll(/.{0,100}(Authorization|Bearer|auth|token|credential|x-auth).{0,100}/gi)].map(m => m[0]);
  console.log('\n=== Auth patterns ===');
  console.log(authMatches.slice(0, 20).join('\n---\n'));
  
  // Look for the "er" base URL setup
  const baseUrlIdx = text.indexOf('z2.idlixku.com');
  if (baseUrlIdx >= 0) {
    console.log('\n=== Base URL context ===');
    console.log(text.slice(Math.max(0, baseUrlIdx - 200), baseUrlIdx + 300));
  }
}

main().catch(console.error);
