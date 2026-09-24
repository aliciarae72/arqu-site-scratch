// Unit checks for home-book-zoom.js: dot placement, the camera and the readout.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const zoom = require('./home-book-zoom.js');
const axes = require('./home-book-axes.js');
const data = require('./home-book-data.js');

const SCENE = zoom.scene();
const RECT = zoom.plotRect({ width: 540, height: 432 });
const FRAMES = SCENE.framesFor(RECT.w / RECT.h);
const frame = (progress) => zoom.frameAt(progress, FRAMES.start, FRAMES.end, SCENE.focus);
const readAt = (progress) => zoom.readout(zoom.inFrame(SCENE.dots, frame(progress)), SCENE.book.length);

test('every account is one dot, placed by premium and loss ratio, the focus drawn last', () => {
  const dots = zoom.placeDots(data.buildBook());
  assert.equal(dots.length, 240);
  assert.equal(new Set(dots.map((d) => d.index)).size, 240);
  for (const d of dots) {
    assert.equal(d.x, axes.plotX(d.account.premium));
    assert.equal(d.y, axes.plotY(d.account.loss / d.account.premium));
  }
  assert.equal(dots.at(-1).account.focus, true);
  const rest = dots.slice(0, -1).map((d) => d.r);
  assert.deepEqual(
    rest,
    [...rest].sort((a, b) => b - a),
    'a small dot is drawn under a larger one',
  );
});

test('dot area tracks the loss: four times the loss is twice the radius, and no loss is a ring', () => {
  const dots = zoom.placeDots([
    { premium: 100000, loss: 40000, focus: true },
    { premium: 100000, loss: 10000, focus: false },
    { premium: 100000, loss: 0, focus: false },
  ]);
  const r = Object.fromEntries(dots.map((d) => [d.index, d.r]));
  assert.ok(Math.abs(r[0] / r[1] - 2) < 1e-12);
  assert.ok(r[2] > 0);
});

test('the camera opens on the focus alone at 87% and ends on the whole book at 27%', () => {
  assert.deepEqual(readAt(0), { who: 'One account', ratio: '87%' });
  assert.deepEqual(readAt(1), { who: 'Whole book · 240 accounts', ratio: '27%' });
  assert.match(readAt(0.8).who, /^\d+ accounts in view$/);
});

test('pulling back, the focus never leaves the frame and the ratio in view only falls', () => {
  const steps = Array.from({ length: 21 }, (_, i) => i / 20);
  for (const p of steps) {
    assert.equal(zoom.inFrame([SCENE.focus], frame(p)).length, 1, `the focus is out of frame at ${p}`);
  }
  const ratios = steps.map((p) => Number.parseInt(readAt(p).ratio, 10));
  assert.deepEqual(
    ratios,
    [...ratios].sort((a, b) => b - a),
    `ratios ${ratios} do not fall`,
  );
});

test('frameAt keeps the aspect, scales geometrically, and holds the anchor at its share of the frame', () => {
  const from = { cx: 0, cy: 0, width: 10, height: 8 };
  const to = { cx: 100, cy: 80, width: 1000, height: 800 };
  const anchor = { x: 0, y: 0 };
  assert.deepEqual(zoom.frameAt(0, from, to, anchor), from);
  const end = zoom.frameAt(1, from, to, anchor);
  assert.deepEqual([end.cx, end.cy, end.width, end.height], [100, 80, 1000, 800]);
  const mid = zoom.frameAt(0.5, from, to, anchor);
  assert.deepEqual([mid.width, mid.height], [100, 80]);
  assert.ok(Math.abs(mid.cx - 5) < 1e-9 && Math.abs(mid.cy - 4) < 1e-9);
});

test('frameAround fits dots at the given aspect, and inFrame keeps only dots wholly inside', () => {
  const dots = [
    { x: 0, y: 0, r: 4 },
    { x: 20, y: 0, r: 2 },
  ];
  assert.deepEqual(zoom.frameAround(dots, 1, 1.25), { cx: 9, cy: 0, width: 26, height: 20.8 });
  assert.deepEqual(zoom.inFrame(dots, { cx: 0, cy: 0, width: 10, height: 8 }), [dots[0]]);
});

test('scene makes one pair of frames per aspect, and reuses it', () => {
  assert.equal(SCENE.framesFor(1.3), SCENE.framesFor(1.3));
  assert.notEqual(SCENE.framesFor(1.3), SCENE.framesFor(1.6));
  assert.equal(data.percent(SCENE.bookRatio), '27%');
});

test('progressAt holds still, eases through the zoom, and stops at one', () => {
  assert.equal(zoom.progressAt(-50), 0);
  assert.equal(zoom.progressAt(1400), 0);
  assert.equal(zoom.progressAt(1400 + 1900), 0.5);
  assert.ok(zoom.progressAt(1400 + 400) < 400 / 3800, 'the zoom does not ease in');
  assert.equal(zoom.progressAt(1400 + 3800), 1);
});

test('plotRect leaves the margins for the axes; viewBox writes a frame around its centre', () => {
  assert.deepEqual(zoom.plotRect({ width: 500, height: 400 }), { x: 50, y: 28, w: 436, h: 328 });
  assert.equal(zoom.viewBox({ cx: 5, cy: 4, width: 10, height: 8 }), '0.00 0.00 10.00 8.00');
});

test('describe names the book, the axes, the worst loss and the whole-book ratio', () => {
  assert.equal(
    zoom.describe(SCENE),
    'Sample book of 240 accounts, plotted by premium and loss ratio, each dot sized to its incurred loss. ' +
      "The worst account's loss ratio is 87%; the whole book's is 27%.",
  );
});
