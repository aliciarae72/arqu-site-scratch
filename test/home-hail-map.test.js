// Unit checks for home-hail-map.js. The grid it reads is the one the site ships, and
// the cells it is checked against are the ones the map draws, so a lattice that drifts
// off the data fails here rather than on the page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const hail = require('../home-hail-map.js');
const cells = require('../scripts/hail-cells.js');

const ROOT = join(__dirname, '..');
const GRID = hail.decodeGrid(require('../hail-grid.js'));
const DATA = JSON.parse(readFileSync(join(ROOT, 'data/hail-severity.json'), 'utf8'));

const centreOf = (ring) => {
  const box = cells.boxOf(ring);
  return [box.lon, box.lat];
};
const drawn = cells.drawnCells(GRID.frame, DATA.cells);

test('the shipped grid names the same severities as the data, in the same order', () => {
  assert.deepEqual(GRID.categories, DATA.categories);
});

test('every cell the map draws resolves to a square carrying its own severity', () => {
  const missed = [];
  for (const [severity, ring] of drawn) {
    const [lon, lat] = centreOf(ring);
    const square = hail.squareAt(GRID, lon, lat);
    if (!square || hail.severityAt(GRID, square) !== severity) missed.push([lon, lat, severity]);
  }
  assert.deepEqual(missed, [], `${missed.length} of ${drawn.length} cells do not resolve`);
});

test('the grid holds one square per cell the map draws, and no more', () => {
  const squares = new Set(
    drawn.map(([, ring]) => {
      const s = hail.squareAt(GRID, ...centreOf(ring));
      return `${s.col},${s.row}`;
    }),
  );
  assert.equal(hail.filledSquares(GRID), squares.size);
  assert.ok(squares.size > 10000, 'the grid is populated');
});

// A cell centre sits exactly on a lattice centre, so every distance metric agrees there and
// a test that only probes centres proves nothing about the metric. These points come from
// the source rings, so the ring is the oracle rather than the lattice, and they sit at 0.84
// of the way out to each vertex: far enough that dropping the cos(latitude) factor moves
// 4,286 of them to a neighbouring cell, and inside the reach where the lookup is exact.
const REACH = 0.84;

test('a point far off-centre inside a cell still resolves to that cell', () => {
  const whole = drawn.filter(([, ring]) => ring.length === 6);
  assert.ok(whole.length > 10000, 'not enough whole hexagons to sample');
  const missed = [];
  for (const [severity, ring] of whole) {
    const [cx, cy] = centreOf(ring);
    const square = hail.squareAt(GRID, cx, cy);
    for (const [vx, vy] of ring) {
      const at = hail.squareAt(GRID, cx + (vx - cx) * REACH, cy + (vy - cy) * REACH);
      const same = at && at.col === square.col && at.row === square.row;
      if (!same) missed.push({ cx, cy, vx, vy, severity, got: at, want: square });
    }
  }
  assert.deepEqual(missed.slice(0, 3), [], `${missed.length} off-centre points land outside their own cell`);
});

test('a square resolves back to a point inside itself', () => {
  for (const [, ring] of drawn.slice(0, 500)) {
    const square = hail.squareAt(GRID, ...centreOf(ring));
    const centre = hail.squareCentre(GRID, square);
    assert.deepEqual(hail.squareAt(GRID, ...centre), square);
  }
});

test('squareAt refuses a point outside the grid', () => {
  const f = GRID.frame;
  assert.equal(hail.squareAt(GRID, f.west - 5, (f.south + f.north) / 2), null);
  assert.equal(hail.squareAt(GRID, (f.west + f.east) / 2, f.north + 5), null);
});

test('severityAt reports an empty square as empty', () => {
  // The far south-west corner of the frame carries no NOAA record.
  const corner = hail.squareAt(GRID, GRID.frame.west + 0.02, GRID.frame.south + 0.02);
  assert.equal(corner === null || hail.severityAt(GRID, corner) === -1, true);
});

test('decodeGrid inflates every run, and rejects a grid whose runs do not fill it', () => {
  const doc = {
    frame: GRID.frame,
    lattice: GRID.lattice,
    bounds: { col: 0, row: 0, cols: 2, rows: 3 },
    categories: ['Very Low'],
    kx: 1,
    grid: '.2a4',
  };
  assert.deepEqual([...hail.decodeGrid(doc).squares], [-1, -1, 0, 0, 0, 0]);
  assert.throws(() => hail.decodeGrid({ ...doc, grid: '.2a3' }), /5 squares for a 2x3 grid/);
});

test('the frame is Colorado, and the readout names the point in it', () => {
  const f = GRID.frame;
  assert.deepEqual([f.west, f.east, f.south, f.north], [-109.05, -102.05, 37, 41]);
  // Colorado Springs sits at about 38.83N 104.82W, a little east of the middle of the state.
  const u = (-104.82 - f.west) / (f.east - f.west);
  const v = (f.north - 38.83) / (f.north - f.south);
  const readout = hail.readoutAt(GRID, u, v);
  assert.ok(GRID.categories.includes(readout.label), `${readout.label} is not a severity`);
  assert.match(readout.place, /^38\.8\d°N, 104\.8\d°W$/);
});

test('readoutAt returns nothing off the map, and nothing on an empty square', () => {
  assert.equal(hail.readoutAt(GRID, -0.2, 0.5), null);
  assert.equal(hail.readoutAt(GRID, 1.4, 0.5), null);
  assert.equal(hail.readoutAt(GRID, 0.02, 0.98), null);
});

const BOX = { width: 600, height: 440 };

test('the view never uncovers the box it sits in', () => {
  const corners = [
    { scale: 1, x: 0, y: 0 },
    { scale: 1, x: 300, y: -200 },
    { scale: 4, x: 900, y: 400 },
    { scale: 4, x: -9000, y: -9000 },
  ];
  for (const view of corners) {
    const held = hail.clampView(view, BOX);
    assert.ok(held.x <= 0 && held.y <= 0, `${JSON.stringify(held)} leaves a gap at the top left`);
    assert.ok(held.x + BOX.width * held.scale >= BOX.width - 1e-9, 'a gap opens on the right');
    assert.ok(held.y + BOX.height * held.scale >= BOX.height - 1e-9, 'a gap opens at the bottom');
  }
});

test('the view clamps to a framed state at one end and to eight times at the other', () => {
  assert.equal(hail.clampView({ scale: 0.2, x: 0, y: 0 }, BOX).scale, 1);
  assert.equal(hail.clampView({ scale: 40, x: 0, y: 0 }, BOX).scale, hail.MAX_ZOOM);
  assert.deepEqual(hail.clampView({ scale: 1, x: -50, y: 30 }, BOX), { scale: 1, x: 0, y: 0 });
});

test('zooming holds the point under the pointer still', () => {
  const at = { x: 210, y: 160 };
  let view = { scale: 1, x: 0, y: 0 };
  const before = hail.viewToImage(view, at, BOX);
  for (const step of [1.35, 1.35, 1.35]) {
    view = hail.zoomAt(view, at, step, BOX);
    const after = hail.viewToImage(view, at, BOX);
    assert.ok(Math.abs(after.u - before.u) < 1e-9, `u moved to ${after.u}`);
    assert.ok(Math.abs(after.v - before.v) < 1e-9, `v moved to ${after.v}`);
  }
  assert.ok(view.scale > 2, 'three steps of 1.35 pass two times');
});

test('zooming out from a framed state changes nothing, so the page keeps the scroll', () => {
  const framed = { scale: 1, x: 0, y: 0 };
  assert.deepEqual(hail.zoomAt(framed, { x: 10, y: 10 }, 0.7, BOX), framed);
  assert.notDeepEqual(hail.zoomAt(framed, { x: 10, y: 10 }, 1.4, BOX), framed);
});

test('zooming towards the edge pins the view to the edge rather than past it', () => {
  const view = hail.zoomAt({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 4, BOX);
  assert.deepEqual([view.x, view.y], [0, 0]);
  const far = hail.zoomAt({ scale: 1, x: 0, y: 0 }, { x: BOX.width, y: BOX.height }, 4, BOX);
  assert.equal(far.x, BOX.width - BOX.width * far.scale);
  assert.equal(far.y, BOX.height - BOX.height * far.scale);
});

test('viewToImage reads the fraction of the drawing under a point in the box', () => {
  assert.deepEqual(hail.viewToImage({ scale: 1, x: 0, y: 0 }, { x: 300, y: 220 }, BOX), { u: 0.5, v: 0.5 });
  const zoomed = { scale: 2, x: -BOX.width / 2, y: -BOX.height / 2 };
  assert.deepEqual(hail.viewToImage(zoomed, { x: 300, y: 220 }, BOX), { u: 0.5, v: 0.5 });
});

test('imageToView puts a point of the drawing back where it renders', () => {
  const view = { scale: 3, x: -400, y: -300 };
  const at = hail.imageToView(view, { u: 0.42, v: 0.61 }, BOX);
  const back = hail.viewToImage(view, at, BOX);
  assert.ok(Math.abs(back.u - 0.42) < 1e-12 && Math.abs(back.v - 0.61) < 1e-12, JSON.stringify(back));
});

test('the keyboard cursor starts on a square that carries a severity', () => {
  const start = hail.nearestFilled(GRID, hail.squareAt(GRID, -105.55, 39));
  assert.ok(start, 'no filled square near the middle of the state');
  assert.notEqual(hail.severityAt(GRID, start), hail.EMPTY);
});

test('nearestFilled gives up rather than searching the whole grid', () => {
  const sparse = hail.decodeGrid({
    frame: GRID.frame,
    lattice: GRID.lattice,
    kx: 1,
    categories: ['Very Low'],
    bounds: { col: 0, row: 0, cols: 3, rows: 3 },
    grid: '.9',
  });
  assert.equal(hail.nearestFilled(sparse, { col: 1, row: 1 }), null);
});
