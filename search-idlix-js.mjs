// Search IDLIX Next.js bundles for claim/gateToken logic
const BASE = 'https://revidlix-proxy.azaki3697.workers.dev/z2/_next/static/chunks';
const DPL = '?dpl=20260722134309-d0a9efcb5024';

const chunks = [
  '1_0v6exngdege.js',
  '1ua5armwfph8o.js',
  '0yc_kcp1129nn.js',
  '1sc7-2n-sjvsu.js',
  '09zjop29yvfuk.js',
  '33fdm48ajsn_y.js',
  '2gt1cvm6yi46q.js',
  '1-8s9_t85wwr4.js',
  '19p5g9d6-dxjd.js',
];

const KEYWORDS = ['session/claim', 'gateToken', 'playback', 'claimWith', 'redeemUrl', 'play-info'];

async function main() {
  for (const chunk of chunks) {
    try {
      const url = `${BASE}/${chunk}${DPL}`;
      const res = await fetch(url);
      if (!res.ok) { console.log(`SKIP ${chunk}: ${res.status}`); continue; }
      const text = await res.text();
      
      const found = KEYWORDS.filter(k => text.includes(k));
      if (found.length > 0) {
        console.log(`\n=== FOUND IN ${chunk} ===`);
        console.log('Keywords:', found.join(', '));
        
        // Extract context around each keyword
        for (const kw of found) {
          const idx = text.indexOf(kw);
          if (idx >= 0) {
            const start = Math.max(0, idx - 150);
            const end = Math.min(text.length, idx + 300);
            console.log(`\n--- "${kw}" context ---`);
            console.log(text.slice(start, end));
          }
        }
      } else {
        console.log(`  ${chunk}: no match`);
      }
    } catch (e) {
      console.error(`ERROR ${chunk}:`, e.message);
    }
  }
}

main().catch(console.error);
