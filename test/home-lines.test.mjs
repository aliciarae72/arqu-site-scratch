// Unit checks for home-lines.js. The browser is the boundary: the document,
// Image, IntersectionObserver and console are small stand-ins, and every
// function under test is the real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const lines = createRequire(import.meta.url)('../home-lines.js');

class Element {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = new Map(Object.entries(attrs));
    this.children = [];
    this.classes = new Set();
    this.classList = { add: (name) => this.classes.add(name) };
    this.found = {};
  }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null; }
  hasAttribute(key) { return this.attrs.has(key); }
  appendChild(child) { this.children.push(child); return child; }
  querySelector(selector) { return this.found[selector] || null; }
  querySelectorAll(selector) { return this.found[selector] || []; }
}

const doc = {
  createElementNS: (ns, tag) => Object.assign(new Element(tag), { ns }),
  createElement: (tag) => new Element(tag),
};

function dotsOf(path) {
  return [...path.matchAll(/M(\d+) (\d+)h0/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

class Image {
  set src(value) { this.url = value; Image.last = this; }
}

function browser(extra = {}) {
  const warnings = [];
  return { warnings, Image, console: { warn: (message) => warnings.push(message) }, ...extra };
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
  assert.deepEqual(dots.slice(36), [[175, 5], [185, 5]]);
  assert.deepEqual(dotsOf(lines.dotPath(36)).at(-1), [355, 5]);
});

test('buildColumn draws a hidden svg sized to the grid, with no ring on an ordinary column', () => {
  const stack = new Element('div', { 'data-count': '1349' });
  const svg = lines.buildColumn(doc, stack);
  assert.equal(stack.children[0], svg);
  assert.equal(svg.getAttribute('viewBox'), '0 0 360 380');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(svg.children.map((c) => c.tag), ['path']);
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

test('revealOnView fills the chart only once it scrolls into view', () => {
  const chart = new Element('figure');
  let observer;
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(el) { this.target = el; }
    disconnect() { this.disconnected = true; }
  }
  lines.revealOnView(browser({ IntersectionObserver }), chart);
  assert.equal(observer.target, chart);
  observer.callback([{ isIntersecting: false }]);
  assert.equal(chart.classes.has('in'), false);
  observer.callback([{ isIntersecting: true }]);
  assert.equal(chart.classes.has('in'), true);
  assert.equal(observer.disconnected, true);
});

test('revealOnView fills the chart at once without IntersectionObserver', () => {
  const chart = new Element('figure');
  lines.revealOnView(browser(), chart);
  assert.equal(chart.classes.has('in'), true);
});

function hailHost() {
  return new Element('div', { 'data-flourish': '26638881', 'data-title': 'Hail map', 'data-state': 'loading' });
}

test('mountHail embeds the map once its published thumbnail loads', () => {
  const host = hailHost();
  const win = browser();
  lines.mountHail(doc, win, host);
  assert.equal(Image.last.url, 'https://public.flourish.studio/visualisation/26638881/thumbnail');
  assert.equal(host.children.length, 0);
  Image.last.onload();
  const frame = host.children[0];
  assert.equal(frame.tag, 'iframe');
  assert.equal(frame.getAttribute('src'), 'https://flo.uri.sh/visualisation/26638881/embed');
  assert.equal(frame.getAttribute('title'), 'Hail map');
  assert.equal(host.getAttribute('data-state'), 'live');
  assert.deepEqual(win.warnings, []);
});

test('mountHail shows the unpublished state, and names the map, when the thumbnail fails', () => {
  const host = hailHost();
  const win = browser();
  lines.mountHail(doc, win, host);
  Image.last.onerror();
  assert.equal(host.children.length, 0);
  assert.equal(host.getAttribute('data-state'), 'unpublished');
  assert.match(win.warnings[0], /visualisation 26638881 is not published/);
});

test('mount draws every column and starts the hail probe', () => {
  const stacks = ['1349', '3324', '1'].map((count) => new Element('div', { 'data-count': count }));
  const chart = Object.assign(new Element('figure'), { found: { '.dots-stack[data-count]': stacks } });
  const page = Object.assign(Object.create(doc), {
    querySelector: (selector) => ({ '.dots-chart': chart, '.hail-map[data-flourish]': hailHost() })[selector],
  });
  Image.last = null;
  lines.mount(page, browser());
  assert.deepEqual(stacks.map((s) => dotsOf(s.children[0].children[0].getAttribute('d')).length), [1349, 3324, 1]);
  assert.equal(chart.classes.has('in'), true);
  assert.match(Image.last.url, /26638881\/thumbnail$/);
});

test('mount fails loudly when the section markup is missing', () => {
  const page = Object.assign(Object.create(doc), { querySelector: () => null });
  assert.throws(() => lines.mount(page, browser()), /\.dots-chart is missing from the page/);
});
