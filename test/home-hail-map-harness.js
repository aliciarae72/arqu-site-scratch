// A stand-in for the browser's document, small enough to read in one sitting, mounted
// with the grid the site ships. Every function the hail-map tests call is the real one.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const model = require('../home-hail-map.js');
const ui = require('../home-hail-map-ui.js');

const GRID = model.decodeGrid(JSON.parse(readFileSync(join(__dirname, '..', 'hail-grid.json'), 'utf8')));
const BOX = { width: 600, height: 440, left: 40, top: 20 };

class Element {
  constructor(selector) {
    this.selector = selector;
    this.attrs = new Map();
    this.style = {};
    this.listeners = new Map();
    this.captured = new Set();
    this.hidden = false;
    this.textContent = '';
    this.offsetWidth = 120;
    this.offsetHeight = 22;
    this.children = new Map();
  }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element(selector));
    return this.children.get(selector);
  }
  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  }
  getBoundingClientRect() {
    return BOX;
  }
  setAttribute(key, value) {
    this.attrs.set(key, value);
  }
  removeAttribute(key) {
    this.attrs.delete(key);
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
}

// The fetch never settles, so mount's own load cannot land on top of the grid a test sets.
// load is exercised on its own in home-hail-map-ui.test.js.
function harness({ grid = GRID } = {}) {
  const map = new Element('[data-hail-map]');
  const doc = { querySelector: (s) => (s === '[data-hail-map]' ? map : null) };
  const mounted = ui.mount(doc, () => new Promise(() => {}));
  mounted.grid = grid;
  return mounted;
}

// A point in the box that lands on a cell carrying a severity, found from the grid itself.
function pointOnACell(view = { scale: 1, x: 0, y: 0 }) {
  for (let x = 20; x < BOX.width; x += 7) {
    for (let y = 20; y < BOX.height; y += 7) {
      const at = { x, y };
      const uv = model.viewToImage(view, at, BOX);
      if (model.readoutAt(GRID, uv.u, uv.v)) return at;
    }
  }
  throw new Error('no point in the box lands on a cell');
}

const event = (at, extra = {}) => ({
  clientX: at.x + BOX.left,
  clientY: at.y + BOX.top,
  pointerId: 1,
  prevented: 0,
  stopped: 0,
  preventDefault() {
    this.prevented++;
  },
  stopPropagation() {
    this.stopped++;
  },
  ...extra,
});

// Somewhere on the drawing with no NOAA record under it: the far south-west of the frame.
const EMPTY_POINT = { x: 4, y: BOX.height - 4 };

module.exports = { model, ui, GRID, BOX, harness, pointOnACell, event, EMPTY_POINT };
