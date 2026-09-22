// Renders data/hail-severity.json into hail-severity.svg in the site's palette, and
// into hail-grid.js, the index home-hail-map.js answers a hover from.
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

// squareAt comes from the browser's own module, so placement here and the hover there can
// never drift. The ring geometry is build-time only and lives beside this file.
const hail = (await import('../home-hail-map.js')).default;
const { boxOf, drawnCells } = (await import('./hail-cells.js')).default;
const CELLS = drawnCells(CO, SRC.cells);

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
  // Bucketed on the rounded extent, and the ROUNDED value is what the lattice step is
  // derived from: the source coordinates carry a digit of noise that would otherwise ride
  // into dlon and dlat.
  const tally = new Map();
  for (const b of boxes) {
    const width = Number(b.width.toFixed(4));
    const height = Number(b.height.toFixed(4));
    const key = `${width} ${height}`;
    const seen = tally.get(key) || { count: 0, width, height };
    seen.count++;
    tally.set(key, seen);
  }
  const { width, height } = [...tally.values()].reduce((a, b) => (b.count > a.count ? b : a));
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
// from the result. A cell the source clipped into two pieces lands on one square twice, and
// the two pieces always carry the same severity.
function placeCells(lattice) {
  const open = { frame: CO, lattice, kx, bounds: { col: -1e6, row: -1e6, cols: 2e6, rows: 2e6 } };
  const found = new Map();
  const span = { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity };
  for (const [severity, ring] of CELLS) {
    const box = boxOf(ring);
    const { col, row } = hail.squareAt(open, box.lon, box.lat);
    found.set(`${col},${row}`, severity);
    span.west = Math.min(span.west, col);
    span.east = Math.max(span.east, col);
    span.south = Math.min(span.south, row);
    span.north = Math.max(span.north, row);
  }
  const bounds = { col: span.west, row: span.south, cols: span.east - span.west + 1, rows: span.north - span.south + 1 };
  return { found, bounds };
}

function gridOf() {
  const lattice = latticeOf(CELLS.map(([, ring]) => boxOf(ring)));
  const { found, bounds } = placeCells(lattice);
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

// Shipped as a script rather than as JSON the page fetches: the payload is three kilobytes
// of constant, and a fetch of a relative URL is blocked on file://, which left the hover
// silently dead whenever the page was opened from disk. Same dual-export tail as the other
// two hail files, so a test can require it.
const grid =
  `/* Generated by scripts/build-hail-map.mjs. Do not edit. */\n` +
  `(() => {\n  const doc = ${JSON.stringify(gridOf())};\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = doc;\n` +
  `  else window.hailGrid = doc;\n})();\n`;
const ARTIFACTS = [
  { name: 'hail-severity.svg', at: new URL('../hail-severity.svg', import.meta.url), want: svg },
  { name: 'hail-grid.js', at: new URL('../hail-grid.js', import.meta.url), want: grid },
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
  console.log(`hail-severity.svg and hail-grid.js are current  ${summary}`);
} else {
  for (const { at, want } of ARTIFACTS) writeFileSync(at, want);
  console.log(`hail-severity.svg + hail-grid.js  ${summary}`);
}
