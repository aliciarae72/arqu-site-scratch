// Unit checks for home-book-axes.js: the chart's scales, ticks and the axes it draws.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const axes = require('./home-book-axes.js');

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
  replaceChildren(...nodes) {
    this.children = nodes;
  }
}
const doc = { createElementNS: (_ns, tag) => new Element(tag) };
const FULL = { cx: 500, cy: 400, width: 1000, height: 800 };
const RECT = { x: 50, y: 28, w: 400, h: 320 };

test('premium runs log-scaled across 0 to 1000, loss ratio linearly up 800 to 0', () => {
  assert.equal(axes.plotX(30000), 0);
  assert.ok(Math.abs(axes.plotX(1600000) - 1000) < 1e-9);
  assert.ok(Math.abs(axes.plotX(300000) - axes.plotX(30000) - (axes.plotX(3000000) - axes.plotX(300000))) < 1e-9);
  assert.equal(axes.plotY(0), 800);
  assert.equal(axes.plotY(1), 0);
  assert.equal(axes.plotY(0.25), 600);
});

test('ratio ticks step by 1, 2, 2.5 or 5 of a decade, at most five, inside 0 to 100%', () => {
  assert.deepEqual(axes.ratioTicks(0, 1), [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(axes.ratioTicks(-0.2, 1.3), [0, 0.25, 0.5, 0.75, 1], 'it does not clamp to 0 to 100%');
  assert.deepEqual(axes.ratioTicks(0.8, 0.95), [0.8, 0.85, 0.9, 0.95]);
});

test('premium ticks read 1-2-5 per decade when wide, and evenly when close', () => {
  assert.deepEqual(axes.premiumTicks(30000, 1600000), [50000, 100000, 200000, 500000, 1000000]);
  assert.deepEqual(axes.premiumTicks(900000, 1700000), [1000000, 1200000, 1400000, 1600000]);
});

test('money reads in thousands and millions, without trailing zeros', () => {
  assert.equal(axes.money(50000), '$50k');
  assert.equal(axes.money(1000000), '$1M');
  assert.equal(axes.money(1250000), '$1.25M');
});

test('toScreen maps a plot point through the frame into the plot box', () => {
  assert.deepEqual(axes.toScreen(FULL, RECT, 0, 0), { sx: 50, sy: 28 });
  assert.deepEqual(axes.toScreen(FULL, RECT, 1000, 800), { sx: 450, sy: 348 });
  assert.deepEqual(axes.toScreen(FULL, RECT, 500, 400), { sx: 250, sy: 188 });
});

test('drawAxes labels the whole view and marks the whole-book ratio', () => {
  const layer = new Element('g');
  axes.drawAxes(doc, layer, FULL, RECT, 0.27);
  const texts = layer.children.filter((c) => c.tag === 'text').map((c) => c.textContent);
  assert.deepEqual(
    texts.filter((t) => t.endsWith('%') && !t.startsWith('Whole')),
    ['0%', '25%', '50%', '75%', '100%'],
  );
  assert.deepEqual(
    texts.filter((t) => t.startsWith('$')),
    ['$50k', '$100k', '$200k', '$500k', '$1M'],
  );
  assert.ok(texts.includes('Premium →') && texts.includes('↑ Loss ratio'));
  assert.ok(texts.includes('Whole book 27%'));
  const avg = layer.children.find((c) => c.getAttribute('class') === 'bz-avg');
  assert.equal(avg.getAttribute('y1'), String(axes.toScreen(FULL, RECT, 0, axes.plotY(0.27)).sy));
});

test('drawAxes leaves out the whole-book line when it is out of frame, and ticks too near an edge', () => {
  const layer = new Element('g');
  const close = { cx: axes.plotX(1200000), cy: axes.plotY(0.87), width: 100, height: 80 };
  axes.drawAxes(doc, layer, close, RECT, 0.27);
  const classes = layer.children.map((c) => c.getAttribute('class'));
  assert.ok(!classes.includes('bz-avg'));
  const xs = layer.children
    .filter((c) => c.getAttribute('class') === 'bz-tick')
    .map((c) => Number(c.getAttribute('x1')));
  assert.ok(xs.length > 0);
  assert.ok(xs.every((x) => x >= RECT.x + 16 && x <= RECT.x + RECT.w - 16));
});
