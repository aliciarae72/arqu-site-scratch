// Unit checks for home-book-camera.js: the frames, the clock and the one-time trigger.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const camera = require('./home-book-camera.js');

test('frameAround fits dots at the given aspect and margin', () => {
  const dots = [
    { x: 0, y: 0, r: 4 },
    { x: 20, y: 0, r: 2 },
  ];
  assert.deepEqual(camera.frameAround(dots, 1, 1.25), { cx: 9, cy: 0, width: 26, height: 20.8 });
  assert.deepEqual(camera.frameAround([dots[0]], 1.5, 1), { cx: 0, cy: 0, width: 12, height: 12 });
});

test('frameAt keeps the aspect, scales geometrically, and holds the anchor at its share of the frame', () => {
  const from = { cx: 0, cy: 0, width: 10, height: 8 };
  const to = { cx: 100, cy: 80, width: 1000, height: 800 };
  const anchor = { x: 0, y: 0 };
  assert.deepEqual(camera.frameAt(0, from, to, anchor), from);
  const end = camera.frameAt(1, from, to, anchor);
  assert.deepEqual([end.cx, end.cy, end.width, end.height], [100, 80, 1000, 800]);
  const mid = camera.frameAt(0.5, from, to, anchor);
  assert.deepEqual([mid.width, mid.height], [100, 80]);
  assert.ok(Math.abs(mid.cx - 5) < 1e-9 && Math.abs(mid.cy - 4) < 1e-9);
});

test('progressAt holds still, eases through the pull-back, and stops at one', () => {
  assert.equal(camera.progressAt(-50), 0);
  assert.equal(camera.progressAt(1400), 0);
  assert.equal(camera.progressAt(1400 + 1900), 0.5);
  assert.ok(camera.progressAt(1400 + 400) < 400 / 3800, 'the pull-back does not ease in');
  assert.equal(camera.progressAt(1400 + 3800), 1);
  assert.equal(camera.progressAt(99999), 1);
});

test('play paints from 0 to 1 on animation frames, then stops asking for frames', () => {
  const frames = [];
  const win = { performance: { now: () => 1000 }, requestAnimationFrame: (fn) => frames.push(fn) };
  const painted = [];
  camera.play(win, (p) => painted.push(p));
  for (const at of [1000, 1000 + 1400 + 1900, 1000 + 1400 + 3800]) frames.shift()(at);
  assert.deepEqual(painted, [0, 0.5, 1]);
  assert.equal(frames.length, 0);
});

test('onceHalfSeen waits for half the element on screen, runs once, and stops watching', () => {
  const observers = [];
  const win = {
    IntersectionObserver: class {
      constructor(callback, options) {
        Object.assign(this, { callback, options, watched: null, disconnected: false });
        observers.push(this);
      }
      observe(el) {
        this.watched = el;
      }
      disconnect() {
        this.disconnected = true;
      }
    },
  };
  let runs = 0;
  camera.onceHalfSeen(win, 'fig', () => runs++);
  const [watch] = observers;
  assert.deepEqual([watch.watched, watch.options.threshold], ['fig', 0.5]);
  watch.callback([{ isIntersecting: false }]);
  assert.equal(runs, 0);
  watch.callback([{ isIntersecting: true }]);
  assert.deepEqual([runs, watch.disconnected], [1, true]);
});
