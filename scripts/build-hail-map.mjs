// Renders data/hail-severity.json into hail-severity.svg in the site's palette.
//
// The source is the NOAA hail-severity grid that shipped inside the vendored
// Flourish export: same cells, same categories, same geometry. Only the drawing
// changed. Re-run with `node scripts/build-hail-map.mjs` after editing the data
// or the ramp.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = JSON.parse(readFileSync(new URL('../data/hail-severity.json', import.meta.url), 'utf8'));
const ORDER = SRC.categories;
const CELLS = SRC.cells;

// Site tokens, resolved. An SVG loaded through <img> gets no cascade from the
// page, so the values are baked here rather than referenced as var(--*).
// Ramp runs light-to-dark in the one brand accent: --band, --tint-2, --purple,
// --purple-deep, --ink.
const FILL = {
  'Very Low': '#e9e4dc',
  Low: '#b9b1f5',
  Moderate: '#8c82fa',
  High: '#5e54c8',
  'Very High': '#221f20',
};

// Colorado's border is defined by parallels and meridians, so these four lines
// ARE the state outline, not a simplification of it. Drawing it gives the cells
// a geographic anchor; without one they read as dots floating in space, which
// is what the satellite basemap in the old export was doing.
const CO = { w: -109.05, e: -102.05, s: 37.0, n: 41.0 };

const W = 1000;
const lons = CELLS.flatMap((c) => c[1].map((p) => p[0]));
const lats = CELLS.flatMap((c) => c[1].map((p) => p[1]));
// Frame the state AND every cell: some records sit just south of the border.
const PAD = 0.12;
const lon0 = Math.min(CO.w, ...lons) - PAD;
const lon1 = Math.max(CO.e, ...lons) + PAD;
const lat0 = Math.min(CO.s, ...lats) - PAD;
const lat1 = Math.max(CO.n, ...lats) + PAD;
// Equirectangular with a cos(lat) correction: over a 5-degree span at this
// latitude it is visually indistinguishable from a conic, and it keeps the
// projection auditable in four lines.
const kx = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
const scale = W / ((lon1 - lon0) * kx);
const H = Math.round((lat1 - lat0) * scale);
const px = (lon) => (lon - lon0) * kx * scale;
const py = (lat) => (lat1 - lat) * scale;

// One path per severity, subpaths encoded relative to the previous point so the
// deltas stay one or two digits.
function pathFor(catIndex) {
  let d = '';
  let cx = 0;
  let cy = 0;
  for (const [cat, ring] of CELLS) {
    if (cat !== catIndex) continue;
    let first = true;
    let sx = 0;
    let sy = 0;
    for (const [lon, lat] of ring) {
      const x = Math.round(px(lon));
      const y = Math.round(py(lat));
      d += first ? `m${x - cx} ${y - cy}` : `l${x - cx} ${y - cy}`;
      if (first) {
        sx = x;
        sy = y;
      }
      cx = x;
      cy = y;
      first = false;
    }
    d += 'z';
    // `z` returns the pen to the SUBPATH START, not to the last point drawn, so
    // the next relative `m` has to be measured from there. Tracking the last
    // point instead makes every following cell drift by the ring's own extent.
    cx = sx;
    cy = sy;
  }
  return d;
}

const layers = ORDER.map(
  (cat, i) => `<path fill="${FILL[cat]}" d="${pathFor(i)}"/>`,
).join('\n');

const border = [
  `M${px(CO.w)} ${py(CO.n)}`,
  `L${px(CO.e)} ${py(CO.n)}`,
  `L${px(CO.e)} ${py(CO.s)}`,
  `L${px(CO.w)} ${py(CO.s)}`,
  'Z',
].join('');

const counts = ORDER.map((c, i) => [c, CELLS.filter((x) => x[0] === i).length]);
const label = `Hail severity across Colorado from NOAA storm records. ${counts
  .map(([c, n]) => `${n} ${c}`)
  .join(', ')}. The severe cells cluster along the Front Range and the eastern plains.`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
<title>Hail severity, Colorado</title>
<rect width="${W}" height="${H}" fill="#fbfaf7"/>
${layers}
<path fill="none" stroke="#8d8785" stroke-width="1.6" d="${border}"/>
</svg>
`;
writeFileSync(new URL('../hail-severity.svg', import.meta.url), svg);
console.log(`hail-severity.svg  ${W}x${H}  ${(svg.length / 1024).toFixed(0)} KiB  ${CELLS.length} cells`);
