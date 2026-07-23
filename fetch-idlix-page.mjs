// Fetch z2.idlixku.com movie page via Worker and extract JS bundle info
async function main() {
  const res = await fetch('https://revidlix-proxy.azaki3697.workers.dev/z2/movie/the-conjuring-2013/');
  const html = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('First 500 chars:', html.slice(0, 500));
  
  // Find script src URLs
  const scripts = [...html.matchAll(/src=["']([^"']+\.js[^"']*?)["']/g)].map(m => m[1]);
  console.log('\nScript URLs:', scripts.slice(0, 10));
  
  // Look for API-related patterns
  const apiPatterns = [...html.matchAll(/.{0,60}(session\/claim|gateToken|playInfo|play-info).{0,60}/gi)].map(m => m[0]);
  console.log('\nAPI patterns in HTML:', apiPatterns.slice(0, 10));
}
main().catch(console.error);
