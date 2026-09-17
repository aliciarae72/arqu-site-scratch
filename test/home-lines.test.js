// Unit checks for home-lines.js. The document is a small stand-in for the browser's,
// and every function under test is the real one.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const lines = require('../home-lines.js');

class Element {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = new Map(Object.entries(attrs));
    this.children = [];
  }
  setAttribute(key, value) {
    this.attrs.set(key, String(value));
  }
  getAttribute(key) {
    return this.attrs.has(key) ? this.attrs.get(key) : null;
  }
  hasAttribute(key) {
    return this.attrs.has(key);
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

const doc = { createElementNS: (_ns, tag) => new Element(tag) };

function dotsOf(path) {
  return [...path.matchAll(/M(\d+) (\d+)h0/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test('every column shares one width, and rows round up', () => {
  assert.deepEqual(lines.dotGrid(3324), { rows: 93, width: 360, height: 930 });
  assert.deepEqual(lines.dotGrid(1349), { rows: 38, width: 360, height: 380 });
  assert.deepEqual(lines.dotGrid(1), { rows: 1, width: 360, height: 10 });
});

test('dotPath draws exactly one dot per record, each in its own cell inside the grid', () => {
  for (const count of [1, 36, 37, 1349, 3324]) {
    const dots = dotsOf(lines.dotPath(count));
    const { width, height } = lines.dotGrid(count);
    assert.equal(dots.length, count);
    assert.equal(new Set(dots.map(String)).size, count);
    assert.ok(dots.every(([x, y]) => x > 0 && x < width && y > 0 && y < height));
  }
});

test('dots fill from the bottom-left, and the part row on top is centred', () => {
  const dots = dotsOf(lines.dotPath(38));
  assert.deepEqual(dots[0], [5, 15]);
  assert.deepEqual(dots[35], [355, 15]);
  assert.deepEqual(dots.slice(36), [
    [175, 5],
    [185, 5],
  ]);
  assert.deepEqual(dotsOf(lines.dotPath(36)).at(-1), [355, 5]);
});

test('buildColumn draws a hidden svg sized to the grid, with no ring on an ordinary column', () => {
  const stack = new Element('div', { 'data-count': '1349' });
  const svg = lines.buildColumn(doc, stack);
  assert.equal(stack.children[0], svg);
  assert.equal(svg.getAttribute('viewBox'), '0 0 360 380');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(
    svg.children.map((c) => c.tag),
    ['path'],
  );
  assert.equal(svg.children[0].getAttribute('d'), lines.dotPath(1349));
});

test('buildColumn rings the lone dot of the punchline column, centred in its column', () => {
  const stack = new Element('div', { 'data-count': '1', 'data-punchline': '' });
  const svg = lines.buildColumn(doc, stack);
  const ring = svg.children[1];
  assert.deepEqual(dotsOf(svg.children[0].getAttribute('d')), [[180, 5]]);
  assert.equal(ring.getAttribute('class'), 'dots-ring');
  assert.deepEqual([ring.getAttribute('cx'), ring.getAttribute('cy')], ['180', '5']);
});

test('mount draws every column of the chart', () => {
  const stacks = ['1349', '3324', '1'].map((count) => new Element('div', { 'data-count': count }));
  const chart = Object.assign(new Element('figure'), { querySelectorAll: () => stacks });
  lines.mount({ ...doc, querySelector: (selector) => (selector === '.dots-chart' ? chart : null) });
  assert.deepEqual(
    stacks.map((s) => dotsOf(s.children[0].children[0].getAttribute('d')).length),
    [1349, 3324, 1],
  );
});

test('mount fails loudly when the section markup is missing', () => {
  assert.throws(() => lines.mount({ ...doc, querySelector: () => null }), /\.dots-chart is missing from the page/);
});
