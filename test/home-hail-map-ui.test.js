// What home-hail-map-ui.js does with a pointer: the readout, the wheel, and the drag.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { model, ui, GRID, BOX, harness, pointOnACell, event, EMPTY_POINT } = require('./home-hail-map-harness.js');

test('mount refuses a page with no map on it', () => {
  assert.throws(() => ui.mount({ querySelector: () => null }, () => {}), /\[data-hail-map\] is missing/);
});

test('mount starts framed, with nothing said and no cursor', () => {
  const app = harness();
  assert.deepEqual(app.view, { scale: 1, x: 0, y: 0 });
  assert.equal(app.cursor, null);
  assert.equal(app.drag, null);
  assert.equal(app.read.textContent, '');
  // Every gesture the map answers is wired before the grid it needs has arrived.
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

test('hovering a square with no record under it says nothing', () => {
  const app = harness();
  ui.hover(app, EMPTY_POINT);
  assert.equal(app.tip.hidden, true);
  assert.equal(app.read.textContent, '');
});

test('the readout waits for the grid rather than guessing', () => {
  const app = harness({ grid: null });
  ui.hover(app, pointOnACell());
  assert.equal(app.tip.hidden, true);
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

test('a drag pans the map and never lets the carousel page underneath it', () => {
  const app = harness();
  ui.wheel(app, event({ x: 300, y: 220 }, { deltaY: -400 }));
  const zoomed = app.view;
  const down = event({ x: 300, y: 220 });
  app.map.listeners.get('pointerdown')(down);
  assert.equal(down.stopped, 1);
  assert.equal(app.map.attrs.has('data-grabbing'), true);
  app.map.listeners.get('pointermove')(event({ x: 260, y: 200 }));
  assert.equal(app.view.x, zoomed.x - 40);
  assert.equal(app.view.y, zoomed.y - 20);
  const up = event({ x: 260, y: 200 });
  app.map.listeners.get('pointerup')(up);
  assert.equal(up.stopped, 1);
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

test('a pointer up with no drag under it is not an end of drag', () => {
  const app = harness();
  const up = event({ x: 10, y: 10 });
  app.map.listeners.get('pointerup')(up);
  assert.equal(up.stopped, 0);
});

test('leaving the map with no cursor says nothing', () => {
  const app = harness();
  app.map.listeners.get('pointerleave')();
  assert.equal(app.tip.hidden, true);
});

test('load reads the shipped grid, and names the status when the file is not served', async () => {
  const app = harness({ grid: null });
  const doc = JSON.parse(readFileSync(join(__dirname, '..', 'hail-grid.json'), 'utf8'));
  await ui.load(app, () => Promise.resolve({ ok: true, json: () => Promise.resolve(doc) }));
  assert.equal(model.filledSquares(app.grid), model.filledSquares(GRID));
  await assert.rejects(
    () => ui.load(app, () => Promise.resolve({ ok: false, status: 404 })),
    /hail-grid\.json answered 404/,
  );
});
