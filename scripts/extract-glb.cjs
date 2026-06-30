// One-shot: pull the embedded base64 GLB out of the reference HTML into a real asset.
const fs = require('fs');
const path = require('path');

const HTML = process.argv[2] || path.join(__dirname, '..', 'aquarium.html');
const OUT_DIR = path.join(__dirname, '..', 'public', 'models');

const html = fs.readFileSync(HTML, 'utf8');
const m = html.match(/window\.RED_GLB_B64\s*=\s*"([^"]+)"/);
if (!m) {
  console.error('RED_GLB_B64 not found');
  process.exit(1);
}
const buf = Buffer.from(m[1], 'base64');
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, 'red.glb');
fs.writeFileSync(out, buf);

const magic = buf.toString('ascii', 0, 4);
console.log(`wrote ${out}  (${buf.length} bytes, magic="${magic}")`);
