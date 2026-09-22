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

// deltaY is in whatever unit deltaMode names. Firefox reports lines for a mouse wheel, so
// a pixel reading of the same gesture zooms by almost nothing.
test('a wheel notch zooms the same whether it arrives in pixels, lines or pages', () => {
  const at = pointOnACell();
  const scaleAfter = (extra) => {
    const app = harness();
    ui.wheel(app, event(at, extra));
    return app.view.scale;
  };
  const pixels = scaleAfter({ deltaY: -240, deltaMode: 0 });
  const lines = scaleAfter({ deltaY: -15, deltaMode: 1 });
  const pages = scaleAfter({ deltaY: -240 / BOX.height, deltaMode: 2 });
  assert.ok(pixels > 1, `a pixel wheel did not zoom: ${pixels}`);
  assert.ok(Math.abs(lines - pixels) < 1e-9, `lines zoomed to ${lines}, pixels to ${pixels}`);
  assert.ok(Math.abs(pages - pixels) < 1e-9, `pages zoomed to ${pages}, pixels to ${pixels}`);
  // Read as raw pixels, fifteen lines would be a rounding error rather than a zoom.
  assert.equal(ui.wheelPixels({ deltaY: -15, deltaMode: 1 }, BOX), -240);
  assert.equal(ui.wheelPixels({ deltaY: -2, deltaMode: 2 }, BOX), -2 * BOX.height);
  assert.equal(ui.wheelPixels({ deltaY: -240, deltaMode: 0 }, BOX), -240);
});

test('starting a drag drops the readout, which no longer names what is under the pointer', () => {
  const app = harness();
  ui.hover(app, pointOnACell());
  assert.equal(app.tip.hidden, false);
  app.map.listeners.get('pointerdown')(event({ x: 300, y: 220 }));
  assert.equal(app.tip.hidden, true, 'the tooltip survived the start of a drag');
  assert.equal(app.read.textContent, '');
});

// A box that shrinks while the map is zoomed and pushed against an edge can leave the old
// translation outside the new clamp range, uncovering part of the box.
test('refit pulls a zoomed view back inside a box that has shrunk', () => {
  const app = harness();
  ui.wheel(app, event({ x: BOX.width, y: BOX.height }, { deltaY: -600 }));
  assert.ok(app.view.scale > 1);
  assert.ok(app.view.x < 0, 'the view is pushed against an edge');
  const wide = app.view;
  app.map.getBoundingClientRect = () => ({ ...BOX, width: BOX.width / 3, height: BOX.height / 3 });
  ui.refit(app);
  const narrow = { width: BOX.width / 3, height: BOX.height / 3 };
  assert.ok(app.view.x <= 0 && app.view.y <= 0, 'a gap opened at the top left');
  assert.ok(app.view.x + narrow.width * app.view.scale >= narrow.width - 1e-9, 'a gap opened on the right');
  assert.ok(app.view.y + narrow.height * app.view.scale >= narrow.height - 1e-9, 'a gap opened at the bottom');
  assert.notDeepEqual(app.view, wide, 'refit changed nothing');
});

// moveDrag is anchored on the box and the view captured at pointerdown. A resize clamps
// ui.view underneath it, so a gesture that carried on would snap the map to numbers it
// never started from.
test('a resize mid-drag ends the drag rather than letting it resume on stale anchors', () => {
  const app = harness();
  ui.wheel(app, event({ x: 300, y: 220 }, { deltaY: -600 }));
  app.map.listeners.get('pointerdown')(event({ x: 300, y: 220 }));
  assert.ok(app.drag, 'the drag did not start');
  app.map.getBoundingClientRect = () => ({ ...BOX, width: BOX.width / 2, height: BOX.height / 2 });
  ui.refit(app);
  assert.equal(app.drag, null, 'the drag survived the resize');
  assert.equal(app.map.attrs.has('data-grabbing'), false);
  // A move after the resize is a hover, and leaves the refitted view alone.
  const settled = app.view;
  app.map.listeners.get('pointermove')(event({ x: 100, y: 100 }));
  assert.deepEqual(app.view, settled, 'a move after the resize moved the map');
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
