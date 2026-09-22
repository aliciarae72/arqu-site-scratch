// Renders data/hail-severity.json into hail-severity.svg in the site's palette, and
// into hail-grid.json, the index home-hail-map.js answers a hover from.
//
// The source is the NOAA hail-severity grid that shipped inside the vendored
// Flourish export: same cells, same categories, same geometry. Only the drawing
// changed. Re-run with `node scripts/build-hail-map.mjs` after editing the data
// or the ramp.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = JSON.parse(readFileSync(new URL('../data/hail-severity.json', import.meta.url), 'utf8'));
const ORDER = SRC.categories;

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
// ARE the state outline, not a simplification of it.
const CO = { west: -109.05, east: -102.05, south: 37.0, north: 41.0 };

function boxOf(ring) {
  const lon = ring.map((p) => p[0]);
  const lat = ring.map((p) => p[1]);
  const west = Math.min(...lon);
  const east = Math.max(...lon);
  const south = Math.min(...lat);
  const north = Math.max(...lat);
  return { width: east - west, height: north - south, lon: (west + east) / 2, lat: (south + north) / 2 };
}

// The extract runs past the state line to the north and the south-west. The figure is
// Colorado, so a cell centred outside it is neither drawn nor counted, and the ones that
// straddle the line are trimmed by the clip rather than dropped.
const inCO = (box) => box.lon >= CO.west && box.lon <= CO.east && box.lat >= CO.south && box.lat <= CO.north;
const CELLS = SRC.cells.filter(([, ring]) => inCO(boxOf(ring)));

const W = 1000;
// Equirectangular with a cos(lat) correction: over a 5-degree span at this
// latitude it is visually indistinguishable from a conic, and it keeps the
// projection auditable in four lines.
const kx = Math.cos((((CO.south + CO.north) / 2) * Math.PI) / 180);
const scale = W / ((CO.east - CO.west) * kx);
const H = Math.round((CO.north - CO.south) * scale);
const px = (lon) => (lon - CO.west) * kx * scale;
const py = (lat) => (CO.north - lat) * scale;

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

// The cells are a flat-top hexagonal lattice. Deriving its step and anchor from the data
// rather than writing four constants here means a re-extract cannot leave the hover
// reading the wrong square while every test stays green.
function latticeOf(boxes) {
  const tally = new Map();
  for (const b of boxes) {
    const key = `${b.width.toFixed(4)} ${b.height.toFixed(4)}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  const [width, height] = [...tally].sort((a, b) => b[1] - a[1])[0][0].split(' ').map(Number);
  const whole = boxes.filter((b) => Math.abs(b.width - width) < width / 50 && Math.abs(b.height - height) < height / 50);
  // A flat-top hexagon is 2R across and stands one row high; columns step 1.5R.
  const dlon = width * 0.75;
  const west = Math.min(...whole.map((b) => b.lon));
  // Column zero anchors the rows. Its neighbours sit half a row off it, which is the
  // offset home-hail-map.js applies on the way back.
  const column0 = whole.filter((b) => Math.round((b.lon - west) / dlon) === 0);
  return { west, south: Math.min(...column0.map((b) => b.lat)), dlon, dlat: height };
}

// Runs are a symbol and an optional length: `a` is one Very Low square, `.48` is
// forty-eight empty ones. Letters, so a length can never be read as the next symbol.
function encodeRuns(symbols) {
  let out = '';
  for (let i = 0; i < symbols.length; ) {
    let j = i;
    while (j < symbols.length && symbols[j] === symbols[i]) j++;
    out += j - i > 1 ? symbols[i] + (j - i) : symbols[i];
    i = j;
  }
  return out;
}

// Places every drawn cell on the lattice, reading the placement back out of the browser's
// own squareAt so the two cannot drift. Bounds are unknown until the last cell lands, so
// placement runs against a grid wide enough to hold anything and the extent is measured
// from the result. A cell the source clipped into two pieces lands on one square twice;
// the two pieces always carry the same severity, which test/hail-map.test.js pins.
function placeCells(hail, lattice) {
  const open = { frame: CO, lattice, kx, bounds: { col: -1e6, row: -1e6, cols: 2e6, rows: 2e6 } };
  const found = new Map();
  for (const [severity, ring] of CELLS) {
    const box = boxOf(ring);
    const square = hail.squareAt(open, box.lon, box.lat);
    found.set(`${square.col},${square.row}`, severity);
  }
  return found;
}

function boundsOf(found) {
  const at = [...found.keys()].map((key) => key.split(',').map(Number));
  const cols = at.map(([col]) => col);
  const rows = at.map(([, row]) => row);
  return {
    col: Math.min(...cols),
    row: Math.min(...rows),
    cols: Math.max(...cols) - Math.min(...cols) + 1,
    rows: Math.max(...rows) - Math.min(...rows) + 1,
  };
}

function gridOf(hail) {
  const lattice = latticeOf(CELLS.map(([, ring]) => boxOf(ring)));
  const found = placeCells(hail, lattice);
  const bounds = boundsOf(found);
  const symbols = [];
  // Column-major, which is the order home-hail-map.js indexes the decoded grid in.
  for (let col = bounds.col; col < bounds.col + bounds.cols; col++) {
    for (let row = bounds.row; row < bounds.row + bounds.rows; row++) {
      const severity = found.get(`${col},${row}`);
      symbols.push(severity === undefined ? '.' : String.fromCharCode(97 + severity));
    }
  }
  return { frame: CO, lattice, kx, categories: ORDER, bounds, grid: encodeRuns(symbols) };
}

const border = [
  `M${px(CO.west)} ${py(CO.north)}`,
  `L${px(CO.east)} ${py(CO.north)}`,
  `L${px(CO.east)} ${py(CO.south)}`,
  `L${px(CO.west)} ${py(CO.south)}`,
  'Z',
].join('');

const counts = ORDER.map((c, i) => [c, CELLS.filter((x) => x[0] === i).length]);
const label = `Hail severity across Colorado from NOAA storm records. ${counts
  .map(([c, n]) => `${n} ${c}`)
  .join(', ')}. The severe cells cluster along the Front Range and the eastern plains.`;

// The cells are clipped to the border rather than framed loosely around it: the extract
// spills past the state line, and a grey footprint outside Colorado on a map of Colorado
// reads as the drawing being wrong.
const layers = ORDER.map((cat, i) => `<path fill="${FILL[cat]}" d="${pathFor(i)}"/>`).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
<title>Hail severity, Colorado</title>
<rect width="${W}" height="${H}" fill="#fbfaf7"/>
<clipPath id="colorado"><path d="${border}"/></clipPath>
<g clip-path="url(#colorado)">
${layers}
</g>
<path fill="none" stroke="#8d8785" stroke-width="1.6" d="${border}"/>
</svg>
`;

const hail = (await import('../home-hail-map.js')).default;
const grid = `${JSON.stringify(gridOf(hail), null, 0)}\n`;
const ARTIFACTS = [
  { name: 'hail-severity.svg', at: new URL('../hail-severity.svg', import.meta.url), want: svg },
  { name: 'hail-grid.json', at: new URL('../hail-grid.json', import.meta.url), want: grid },
];
const summary = `${W}x${H}  ${(svg.length / 1024).toFixed(0)} KiB  ${CELLS.length} cells  ` +
  `grid ${(grid.length / 1024).toFixed(1)} KiB`;

// home.html deploys the committed artifacts, not this generator's output, so the two have
// to be equal. --check compares them and writes nothing. bin/test runs it.
if (process.argv.includes('--check')) {
  for (const { name, at, want } of ARTIFACTS) {
    let current = null;
    try {
      current = readFileSync(at, 'utf8');
    } catch {
      console.error(`${name} is missing — run: node scripts/build-hail-map.mjs`);
      process.exit(1);
    }
    if (current !== want) {
      console.error(
        `${name} is stale against data/hail-severity.json ` +
          `(committed ${current.length} bytes, regenerates to ${want.length}). ` +
          `Run: node scripts/build-hail-map.mjs`,
      );
      process.exit(1);
    }
  }
  console.log(`hail-severity.svg and hail-grid.json are current  ${summary}`);
} else {
  for (const { at, want } of ARTIFACTS) writeFileSync(at, want);
  console.log(`hail-severity.svg + hail-grid.json  ${summary}`);
}
