// Find preroll acknowledgment and gate flow state machine
const URL = 'https://revidlix-proxy.azaki3697.workers.dev/z2/_next/static/chunks/33fdm48ajsn_y.js?dpl=20260722134309-d0a9efcb5024';

async function main() {
  const res = await fetch(URL);
  const text = await res.text();
  
  // Look for preroll/ad acknowledgment API calls
  const prerollMatches = [...text.matchAll(/.{0,300}(preroll|ad.*ack|ack.*ad|skipAd|adView|ad.*complete|trackAd|advertis).{0,300}/gi)].map(m => m[0]);
  console.log('=== preroll/ad ack patterns ===');
  prerollMatches.slice(0, 10).forEach(m => console.log(m + '\n---'));
  
  // Look at the full watchApi object - ALL its methods
  const watchApiIdx = text.indexOf('"watchApi"');
  if (watchApiIdx >= 0) {
    const ctx = text.slice(Math.max(0, watchApiIdx - 100), watchApiIdx + 2000);
    console.log('\n=== Full watchApi object ===');
    console.log(ctx);
  }
  
  // Look for ey() call sites (where Pentos redeem is called)
  const eyMatches = [...text.matchAll(/.{0,200}ey\(|Pentos redeem.{0,200}/gi)].map(m => m[0]);
  console.log('\n=== ey() / Pentos redeem call sites ===');
  eyMatches.slice(0, 5).forEach(m => console.log(m + '\n---'));
}

main().catch(console.error);
