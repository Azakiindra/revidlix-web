// Deep analysis of IDLIX bundle for redeem URL structure and claim response
const URL = 'https://revidlix-proxy.azaki3697.workers.dev/z2/_next/static/chunks/33fdm48ajsn_y.js?dpl=20260722134309-d0a9efcb5024';

async function main() {
  const res = await fetch(URL);
  const text = await res.text();
  
  // Search for majorplay / redeem patterns
  const majorplayMatches = [...text.matchAll(/.{0,200}(majorplay|redeemUrl|redeem|renewalToken).{0,200}/gi)].map(m => m[0]);
  console.log('=== majorplay/redeem patterns ===');
  majorplayMatches.slice(0, 10).forEach(m => console.log(m + '\n---'));
  
  // Search for "countdownSec" or "preroll" to find the gate/claim state machine  
  const countdownMatches = [...text.matchAll(/.{0,300}(countdownSec|preroll|unlockAt|gateToken).{0,300}/gi)].map(m => m[0]);
  console.log('\n=== countdown/gate patterns ===');
  countdownMatches.slice(0, 5).forEach(m => console.log(m + '\n---'));
  
  // Find the "has_session" check which relates to cf_clearance
  const sessionMatches = [...text.matchAll(/.{0,150}(has_session|clearance|cf_clearance).{0,150}/gi)].map(m => m[0]);
  console.log('\n=== session/clearance patterns ===');
  sessionMatches.slice(0, 5).forEach(m => console.log(m + '\n---'));
}

main().catch(console.error);
