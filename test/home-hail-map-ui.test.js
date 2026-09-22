// What home-hail-map-ui.js does with a pointer: the readout, the wheel, and the drag.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  model,
  ui,
  GRID,
  BOX,
  Element,
  harness,
  pointOnACell,
  event,
  EMPTY_POINT,
} = require('./home-hail-map-harness.js');

test('mount refuses a page with no map on it', () => {
  assert.throws(() => ui.mount({ querySelector: () => null }, () => {}), /\[data-hail-map\] is missing/);
});

test('mount starts framed, with nothing said and no cursor', () => {
  const app = harness();
  assert.deepEqual(app.view, { scale: 1, x: 0, y: 0 });
  assert.equal(app.cursor, null);
  assert.equal(app.drag, null);
  assert.equal(app.read.textContent, '');
  // Every gesture the map answers is wired by mount.
  assert.deepEqual([...app.map.listeners.keys()].sort(), [
    'blur',
    'keydown',
    'pointercancel',
    'pointerdown',
    'pointerleave',
    'pointermove',
    'pointerup',
    'wheel',
  ]);
});

test('hovering a cell names its severity and its position, inside the box', () => {
  const app = harness();
  const at = pointOnACell();
  ui.hover(app, at);
  assert.equal(app.tip.hidden, false);
  assert.match(app.label.textContent, /^(Very Low|Low|Moderate|High|Very High)$/);
  assert.match(app.place.textContent, /^\d+\.\d\d°N, \d+\.\d\d°W$/);
  assert.equal(app.read.textContent, `${app.label.textContent}, ${app.place.textContent}`);
  assert.ok(Number.parseFloat(app.tip.style.left) + app.tip.offsetWidth <= BOX.width);
  assert.ok(Number.parseFloat(app.tip.style.top) + app.tip.offsetHeight <= BOX.height);
});

// The map does not sit at the top left of the window. A pointer event carries window
// coordinates, so the box offset has to come off them before the cell is worked out.
test('a real pointer event is read against the box, not the window', () => {
  const app = harness();
  const at = pointOnACell();
  app.map.listeners.get('pointermove')(event(at));
  const throughTheEvent = app.read.textContent;
  ui.hover(app, at);
  assert.equal(throughTheEvent, app.read.textContent, 'the event path and the box path disagree');
  assert.notEqual(throughTheEvent, '');
  // Reading the same event without taking the offset off lands somewhere else entirely.
  ui.hover(app, { x: at.x + BOX.left, y: at.y + BOX.top });
  assert.notEqual(app.read.textContent, throughTheEvent, 'the offset makes no difference to the cell');
});

test('hovering a square with no record under it says nothing', () => {
  const app = harness();
  ui.hover(app, EMPTY_POINT);
  assert.equal(app.tip.hidden, true);
  assert.equal(app.read.textContent, '');
});

// hail-grid.js loads before this file, so a missing grid means the page's script order
// broke. Saying which file is missing beats a null read three calls later.
test('mount refuses to wire a map with no grid behind it', () => {
  const map = new Element('[data-hail-map]');
  const doc = { querySelector: () => map };
  assert.throws(() => ui.mount(doc, null), /hail-grid\.js has to load before this file/);
});

test('a wheel over the map zooms about the pointer and takes the gesture', () => {
  const app = harness();
  const e = event(pointOnACell(), { deltaY: -240 });
  ui.wheel(app, e);
  assert.ok(app.view.scale > 1, `scale stayed at ${app.view.scale}`);
  assert.equal(e.prevented, 1);
  assert.match(app.pan.style.transform, /^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
});

test('a wheel that cannot zoom leaves the scroll to the page', () => {
  const app = harness();
  const e = event({ x: 100, y: 100 }, { deltaY: 240 });
  ui.wheel(app, e);
  assert.deepEqual(app.view, { scale: 1, x: 0, y: 0 });
  assert.equal(e.prevented, 0);
});

test('a drag pans the map by exactly the distance dragged', () => {
  const app = harness();
  ui.wheel(app, event({ x: 300, y: 220 }, { deltaY: -400 }));
  const zoomed = app.view;
  app.map.listeners.get('pointerdown')(event({ x: 300, y: 220 }));
  assert.equal(app.map.attrs.has('data-grabbing'), true);
  // Without the capture, a drag that leaves the map stops moving it mid-gesture.
  assert.equal(app.map.hasPointerCapture(1), true, 'the drag never took the pointer');
  app.map.listeners.get('pointermove')(event({ x: 260, y: 200 }));
  assert.equal(app.view.x, zoomed.x - 40);
  assert.equal(app.view.y, zoomed.y - 20);
  app.map.listeners.get('pointerup')(event({ x: 260, y: 200 }));
  assert.equal(app.map.attrs.has('data-grabbing'), false);
  assert.equal(app.map.hasPointerCapture(1), false);
});

test('a drag cannot open a gap at the edge of the box', () => {
  const app = harness();
  ui.wheel(app, event({ x: 300, y: 220 }, { deltaY: -400 }));
  app.map.listeners.get('pointerdown')(event({ x: 300, y: 220 }));
  app.map.listeners.get('pointermove')(event({ x: 3000, y: 3000 }));
  assert.equal(app.view.x, 0);
  assert.equal(app.view.y, 0);
});

test('a pointer up with no drag under it moves nothing', () => {
  const app = harness();
  app.map.listeners.get('pointerup')(event({ x: 10, y: 10 }));
  assert.equal(app.drag, null);
  assert.deepEqual(app.view, { scale: 1, x: 0, y: 0 });
  assert.equal(app.map.attrs.has('data-grabbing'), false);
});

test('leaving the map with no cursor says nothing', () => {
  const app = harness();
  app.map.listeners.get('pointerleave')();
  assert.equal(app.tip.hidden, true);
});

test('the map answers from the grid the site ships, decoded whole', () => {
  const app = harness();
  assert.equal(model.filledSquares(app.grid), model.filledSquares(GRID));
  assert.ok(model.filledSquares(app.grid) > 10000, 'the shipped grid is populated');
});
