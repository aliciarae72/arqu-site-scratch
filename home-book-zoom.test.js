// Unit checks for home-book-zoom.js. Every function under test is the real one; the
// document and window are small stand-ins that record what the page would see.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const zoom = require('./home-book-zoom.js');

const SCENE = zoom.scene();
const readAt = (progress) =>
  zoom.readout(zoom.inFrame(SCENE.dots, zoom.frameAt(progress, SCENE.start, SCENE.end)), SCENE.book.length);

test('the sample book is 240 accounts, the same on every load, led by one 87% loss', () => {
  const book = zoom.buildBook();
  assert.equal(book.length, 240);
  assert.deepEqual(zoom.buildBook(), book);
  assert.deepEqual(book[0], { premium: 1200000, loss: 1044000, focus: true });
  assert.equal(book.filter((a) => a.focus).length, 1);
  assert.ok(
    book.slice(1).every((a) => a.loss < book[0].loss),
    'another account out-loses the focus',
  );
  assert.ok(
    book.some((a) => a.loss === 0),
    'no loss-free account to balance the book',
  );
});

test('lossRatio is losses over premium, and zero for an empty set', () => {
  assert.equal(
    zoom.lossRatio([
      { premium: 100, loss: 30 },
      { premium: 300, loss: 10 },
    ]),
    0.1,
  );
  assert.equal(zoom.lossRatio([]), 0);
});

test('packDots places every account once, no two dots touching, the worst loss in the middle', () => {
  const dots = zoom.packDots(zoom.buildBook());
  assert.equal(dots.length, 240);
  assert.equal(new Set(dots.map((d) => d.index)).size, 240);
  const focus = dots.find((d) => d.account.focus);
  assert.deepEqual([focus.x, focus.y], [0, 0]);
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const [a, b] = [dots[i], dots[j]];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r, `dots ${a.index} and ${b.index} overlap`);
    }
  }
});

test('dot area tracks the loss: four times the loss is twice the radius', () => {
  const dots = zoom.packDots([
    { premium: 1, loss: 40000, focus: true },
    { premium: 1, loss: 10000, focus: false },
    { premium: 1, loss: 0, focus: false },
  ]);
  const byIndex = Object.fromEntries(dots.map((d) => [d.index, d.r]));
  assert.ok(Math.abs(byIndex[0] / byIndex[1] - 2) < 1e-12);
  assert.ok(byIndex[2] > 0, 'a loss-free account still gets a ring');
});

test('the camera opens on the focus alone at 87% and ends on the whole book at its true ratio', () => {
  assert.deepEqual(readAt(0), { who: 'One account', ratio: '87%' });
  const bookRatio = `${Math.round(zoom.lossRatio(SCENE.book) * 100)}%`;
  assert.equal(bookRatio, '27%');
  assert.deepEqual(readAt(1), { who: 'Whole book · 240 accounts', ratio: bookRatio });
  assert.match(readAt(0.5).who, /^\d+ accounts in view$/);
});

test('pulling back, the ratio in view falls from the one loss toward the book', () => {
  const ratios = [0, 0.35, 0.55, 0.75, 1].map((p) => Number.parseInt(readAt(p).ratio, 10));
  assert.deepEqual(
    ratios,
    [...ratios].sort((a, b) => b - a),
    `ratios ${ratios} do not fall`,
  );
  assert.ok(ratios[0] > ratios.at(-1));
});

test('frameAt holds the aspect, moves from start to end, and scales geometrically', () => {
  const from = { cx: 0, cy: 0, width: 10, height: 8 };
  const to = { cx: 10, cy: 20, width: 1000, height: 800 };
  assert.deepEqual(zoom.frameAt(0, from, to), from);
  assert.deepEqual(zoom.frameAt(1, from, to), to);
  const mid = zoom.frameAt(0.5, from, to);
  assert.deepEqual([mid.cx, mid.cy, mid.height], [5, 10, 80]);
  assert.equal(mid.width, 100);
});

test('frameAround fits a set of dots with its margin, and inFrame keeps only dots wholly inside', () => {
  const dots = [
    { x: 0, y: 0, r: 4 },
    { x: 20, y: 0, r: 2 },
  ];
  const frame = zoom.frameAround(dots, 1);
  assert.deepEqual(frame, { cx: 9, cy: 0, width: 26, height: 20.8 });
  assert.equal(zoom.inFrame(dots, frame).length, 2);
  assert.deepEqual(zoom.inFrame(dots, { cx: 0, cy: 0, width: 10, height: 8 }), [dots[0]]);
});

test('progressAt holds still, eases through the zoom, and stops at one', () => {
  assert.equal(zoom.progressAt(-50), 0);
  assert.equal(zoom.progressAt(1400), 0);
  assert.equal(zoom.progressAt(1400 + 1900), 0.5);
  assert.ok(zoom.progressAt(1400 + 400) < 400 / 3800, 'the zoom does not ease in');
  assert.equal(zoom.progressAt(1400 + 3800), 1);
  assert.equal(zoom.progressAt(99999), 1);
});

test('viewBox writes a frame as x y width height around its centre', () => {
  assert.equal(zoom.viewBox({ cx: 5, cy: 4, width: 10, height: 8 }), '0.00 0.00 10.00 8.00');
});

test('describe names the book, the worst loss and the whole-book ratio', () => {
  assert.equal(
    zoom.describe(SCENE),
    'Sample book of 240 accounts, one dot per account, each dot sized to its incurred loss. ' +
      "The worst account's loss ratio is 87%; the whole book's is 27%.",
  );
});
