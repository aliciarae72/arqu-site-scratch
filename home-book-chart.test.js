// Unit checks for home-book-chart.js: dot placement, the frame, and mount() against a
// stand-in figure and window.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const chart = require('./home-book-chart.js');
const axes = require('./home-book-axes.js');
const data = require('./home-book-data.js');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attrs = new Map();
    this.children = [];
    this.textContent = '';
  }
  setAttribute(key, value) {
    this.attrs.set(key, String(value));
  }
  getAttribute(key) {
    return this.attrs.get(key) ?? null;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
}

// `reduced` stands in for prefers-reduced-motion; animation frames run only when the test paints them
function makePage({ reduced = true } = {}) {
  const parts = {};
  for (const key of ['svg', 'stage', 'ratio', 'count']) parts[key] = new Element(key);
  const fig = new Element('figure');
  fig.querySelector = (selector) => parts[selector.match(/^\[data-bz-(\w+)\]$/)[1]];
  const listeners = {};
  const doc = {
    createElementNS: (_ns, tag) => new Element(tag),
    querySelector: (selector) => (selector === '[data-book-chart]' ? fig : null),
  };
  const frames = [];
  const observers = [];
  let now = 0;
  const win = {
    addEventListener: (type, fn) => (listeners[type] = fn),
    matchMedia: (query) => ({ matches: reduced && query === '(prefers-reduced-motion: reduce)' }),
    performance: { now: () => now },
    requestAnimationFrame: (fn) => frames.push(fn),
    IntersectionObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {}
      disconnect() {}
    },
  };
  const paint = (at) => {
    now = at;
    for (const fn of frames.splice(0)) fn(at);
  };
  return { doc, win, parts, listeners, observers, frames, paint };
}

test('every account is one dot at its premium and loss ratio, the focus drawn last', () => {
  const dots = chart.placeDots(data.buildBook());
  assert.equal(dots.length, 240);
  assert.equal(new Set(dots.map((d) => d.index)).size, 240);
  for (const d of dots.filter((dot) => dot.account.loss)) {
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

test('loss-free accounts spread over a thin band around 0%, not one line', () => {
  const zero = chart.placeDots(data.buildBook()).filter((d) => !d.account.loss);
  const ys = zero.map((d) => d.y - axes.plotY(0));
  assert.ok(
    ys.every((y) => Math.abs(y) <= 12),
    'a loss-free dot strays from 0%',
  );
  assert.ok(new Set(ys.map((y) => y.toFixed(2))).size > zero.length * 0.9, 'the loss-free dots still stack');
});

test('dot area tracks the loss: four times the loss is twice the radius, and no loss is a ring', () => {
  const dots = chart.placeDots([
    { premium: 100000, loss: 40000, focus: true },
    { premium: 100000, loss: 10000, focus: false },
    { premium: 100000, loss: 0, focus: false },
  ]);
  const r = Object.fromEntries(dots.map((d) => [d.index, d.r]));
  assert.ok(Math.abs(r[0] / r[1] - 2) < 1e-12);
  assert.ok(r[2] > 0);
});

test('chartFrame holds the whole plot box at any aspect, with every dot inside it', () => {
  const dots = chart.placeDots(data.buildBook());
  for (const aspect of [0.9, 1.25, 1.33, 1.8]) {
    const f = chart.chartFrame(aspect);
    assert.ok(Math.abs(f.width / f.height - aspect) < 1e-9);
    const inside = (d) =>
      Math.abs(d.x - f.cx) + d.r <= f.width / 2 + 1e-9 && Math.abs(d.y - f.cy) + d.r <= f.height / 2 + 1e-9;
    assert.ok(dots.every(inside), `a dot is cut off at aspect ${aspect}`);
  }
});

test('plotRect leaves the margins for the axes; viewBox writes a frame around its centre', () => {
  assert.deepEqual(chart.plotRect({ width: 500, height: 400 }), { x: 50, y: 28, w: 436, h: 328 });
  assert.equal(chart.viewBox({ cx: 5, cy: 4, width: 10, height: 8 }), '0.00 0.00 10.00 8.00');
});

test('describe names the chart, the worst loss and the whole-book ratio', () => {
  assert.equal(
    chart.describe(chart.scene()),
    'Scatter chart of a sample book of 240 accounts: premium across, loss ratio up, each dot sized to its incurred loss. ' +
      "The worst account's loss ratio is 87%; the whole book's is 22%.",
  );
});

test('with reduced motion, mount draws the whole chart at once: dots, axes, focus label, whole-book total', () => {
  const page = makePage();
  chart.mount(page.doc, page.win);
  const [layer, plot] = page.parts.svg.children;
  assert.deepEqual([layer.getAttribute('class'), plot.getAttribute('class')], ['bz-axes', 'bz-plot']);
  assert.equal(plot.children.length, 240);
  assert.equal(page.parts.svg.getAttribute('viewBox'), '0 0 500 400');
  const texts = layer.children.filter((c) => c.tag === 'text').map((c) => c.textContent);
  assert.ok(texts.includes('One account · 87%') && texts.includes('Whole book 22%') && texts.includes('$1M'));
  assert.deepEqual([page.parts.ratio.textContent, page.parts.count.textContent], ['22%', '240 accounts']);
  assert.equal(page.parts.stage.getAttribute('aria-label'), chart.describe(chart.scene()));
});

test('a resize redraws the axes to fit', () => {
  const page = makePage();
  chart.mount(page.doc, page.win);
  const [layer] = page.parts.svg.children;
  layer.children = [];
  page.listeners.resize();
  assert.ok(layer.children.length > 0, 'the resize did not redraw the axes');
});

test('the chart fits the svg it is drawn in, and falls back when the svg has no size yet', () => {
  const sized = makePage();
  sized.parts.svg.getBoundingClientRect = () => ({ width: 600, height: 480 });
  chart.mount(sized.doc, sized.win);
  assert.equal(sized.parts.svg.getAttribute('viewBox'), '0 0 600 480');
  const unsized = makePage();
  unsized.parts.svg.getBoundingClientRect = () => ({ width: 0, height: 0 });
  chart.mount(unsized.doc, unsized.win);
  assert.equal(unsized.parts.svg.getAttribute('viewBox'), '0 0 500 400');
});

test('it opens close on the worst account, then pulls back to the whole chart once half of it is seen', () => {
  const page = makePage({ reduced: false });
  chart.mount(page.doc, page.win);
  const [layer, plot] = page.parts.svg.children;
  const texts = () => layer.children.filter((c) => c.tag === 'text').map((c) => c.textContent);
  const rect = chart.plotRect({ width: 500, height: 400 });
  const aspect = rect.w / rect.h;
  assert.equal(plot.getAttribute('viewBox'), chart.viewBox(chart.frameFor(chart.scene(), aspect, 0)));
  assert.ok(!texts().includes('One account · 87%'), 'the label is drawn over the close-up');
  assert.ok(!texts().includes('Whole book 22%'), 'the whole-book line shows in the close-up');
  assert.equal(page.frames.length, 0, 'it pulled back before it was seen');
  page.observers[0].callback([{ isIntersecting: true }]);
  page.paint(0);
  page.paint(1400 + 3800);
  assert.equal(plot.getAttribute('viewBox'), chart.viewBox(chart.chartFrame(aspect)));
  assert.ok(texts().includes('One account · 87%') && texts().includes('Whole book 22%'));
  assert.equal(page.frames.length, 0, 'it keeps asking for frames after the end');
});

test('frameFor opens on the worst account alone and ends on the whole chart', () => {
  const sc = chart.scene();
  const inside = (d, f) =>
    Math.abs(d.x - f.cx) + d.r <= f.width / 2 + 1e-9 && Math.abs(d.y - f.cy) + d.r <= f.height / 2 + 1e-9;
  const start = chart.frameFor(sc, 1.3, 0);
  assert.deepEqual(
    sc.dots.filter((d) => inside(d, start)).map((d) => d.account.focus),
    [true],
  );
  assert.deepEqual(chart.frameFor(sc, 1.3, 1), chart.chartFrame(1.3));
  for (let p = 0; p <= 1; p += 0.05)
    assert.ok(inside(sc.focus, chart.frameFor(sc, 1.3, p)), `the focus leaves at ${p}`);
});

test('mount fails loudly when the figure is missing', () => {
  const page = makePage();
  assert.throws(
    () => chart.mount({ ...page.doc, querySelector: () => null }, page.win),
    /\[data-book-chart\] is missing from the page/,
  );
});
