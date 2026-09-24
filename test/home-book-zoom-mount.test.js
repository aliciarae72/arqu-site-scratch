// mount() from home-book-zoom.js, run against a stand-in figure and window. The
// window hands out animation frames on demand, so the test steps the clock itself.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const zoom = require('../home-book-zoom.js');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attrs = new Map();
    this.children = [];
    this.listeners = {};
    this.textContent = '';
    this.hidden = false;
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
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
}

function makePage({ reduced = false } = {}) {
  const parts = {};
  for (const key of ['svg', 'stage', 'ratio', 'who', 'note', 'replay']) parts[key] = new Element(key);
  const fig = new Element('figure');
  fig.querySelector = (selector) => parts[selector.match(/^\[data-bz-(\w+)\]$/)[1]];
  const doc = {
    createElementNS: (_ns, tag) => new Element(tag),
    querySelector: (selector) => (selector === '[data-book-zoom]' ? fig : null),
  };
  const frames = [];
  const observers = [];
  let now = 0;
  const listeners = {};
  const win = {
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    performance: { now: () => now },
    requestAnimationFrame: (fn) => frames.push(fn),
    matchMedia: (query) => ({ matches: reduced && query === '(prefers-reduced-motion: reduce)' }),
    IntersectionObserver: class {
      constructor(callback, options) {
        Object.assign(this, { callback, options, watching: [], disconnected: false });
        observers.push(this);
      }
      observe(el) {
        this.watching.push(el);
      }
      disconnect() {
        this.disconnected = true;
      }
    },
  };
  // runs every queued frame at time `at`, the way the browser would on its next paint
  const paint = (at) => {
    now = at;
    for (const fn of frames.splice(0)) fn(at);
  };
  return { doc, win, fig, parts, frames, observers, paint, listeners };
}

const state = ({ fig, parts }) => ({
  phase: fig.getAttribute('data-phase'),
  ratio: parts.ratio.textContent,
  who: parts.who.textContent,
  note: parts.note.textContent,
});

test('mount draws every account and labels the stage with the whole story', () => {
  const page = makePage();
  zoom.mount(page.doc, page.win);
  const [axesLayer, plot] = page.parts.svg.children;
  assert.deepEqual([axesLayer.getAttribute('class'), plot.getAttribute('class')], ['bz-axes', 'bz-plot']);
  assert.equal(plot.children.length, 240);
  assert.equal(plot.children.filter((c) => /bz-focus/.test(c.getAttribute('class'))).length, 1);
  assert.equal(page.parts.svg.getAttribute('viewBox'), '0 0 500 400');
  assert.deepEqual(
    ['x', 'y', 'width', 'height'].map((k) => plot.getAttribute(k)),
    ['50', '28', '436', '328'],
  );
  assert.ok(
    axesLayer.children.some((c) => c.textContent === 'Premium →'),
    'the axes are not drawn',
  );
  assert.equal(page.parts.stage.getAttribute('aria-label'), zoom.describe(zoom.scene()));
});

test('it waits on the focus until half the figure is on screen, then plays through to the book', () => {
  const page = makePage();
  zoom.mount(page.doc, page.win);
  assert.deepEqual(state(page), {
    phase: 'one',
    ratio: '87%',
    who: 'One account',
    note: 'One account. One awful loss.',
  });
  const [watch] = page.observers;
  assert.equal(watch.options.threshold, 0.5);
  watch.callback([{ isIntersecting: false }]);
  assert.equal(page.frames.length, 0, 'it played while off screen');
  watch.callback([{ isIntersecting: true }]);
  assert.ok(watch.disconnected);
  page.paint(0);
  page.paint(1400 + 1900);
  assert.equal(state(page).phase, 'zoom');
  assert.equal(state(page).note, 'Now the rest of the book…');
  page.paint(1400 + 3800);
  assert.deepEqual(state(page), {
    phase: 'book',
    ratio: '27%',
    who: 'Whole book · 240 accounts',
    note: 'The rest of the book carries it.',
  });
  assert.equal(page.frames.length, 0, 'it keeps asking for frames after the end');
});

test('Replay starts over from the one loss, and cancels a play already running', () => {
  const page = makePage();
  zoom.mount(page.doc, page.win);
  page.parts.replay.listeners.click();
  page.paint(0);
  page.paint(3000);
  page.parts.replay.listeners.click();
  page.paint(3000);
  assert.equal(state(page).ratio, '87%');
  page.paint(3000 + 1400 + 3800);
  assert.equal(state(page).ratio, '27%');
});

test('with reduced motion it shows the whole book at once and hides Replay', () => {
  const page = makePage({ reduced: true });
  zoom.mount(page.doc, page.win);
  assert.equal(state(page).phase, 'book');
  assert.equal(state(page).ratio, '27%');
  assert.equal(page.parts.replay.hidden, true);
  assert.equal(page.observers.length, 0);
});

test('mount fails loudly when the figure is missing', () => {
  const page = makePage();
  assert.throws(
    () => zoom.mount({ ...page.doc, querySelector: () => null }, page.win),
    /\[data-book-zoom\] is missing from the page/,
  );
});

test('a resize repaints the chart at the moment it was showing', () => {
  const page = makePage({ reduced: true });
  zoom.mount(page.doc, page.win);
  const [axesLayer] = page.parts.svg.children;
  axesLayer.children = [];
  page.listeners.resize();
  assert.equal(state(page).ratio, '27%');
  assert.ok(axesLayer.children.length > 0, 'the resize did not redraw the axes');
});
