// What home-hail-map-ui.js does with a keyboard: the cell cursor, its mark, and zoom.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { model, ui, GRID, BOX, harness, pointOnACell, event, EMPTY_POINT } = require('./home-hail-map-harness.js');

const press = (app, key) => ui.key(app, event({ x: 0, y: 0 }, { key }));
const cursorAt = (app) => {
  const [lon, lat] = model.squareCentre(GRID, app.cursor);
  return model.imageToView(app.view, model.imageOf(GRID, lon, lat), BOX);
};

test('an arrow key puts a cursor on a cell, says what it is, and marks it on the drawing', () => {
  const app = harness();
  press(app, 'ArrowRight');
  assert.ok(app.cursor, 'no cursor landed');
  assert.notEqual(model.severityAt(GRID, app.cursor), model.EMPTY);
  assert.match(app.read.textContent, /^(Very Low|Low|Moderate|High|Very High), /);
  assert.equal(app.dot.hidden, false, 'the cursor is not marked on the drawing');
  const at = cursorAt(app);
  assert.equal(app.dot.style.left, `${at.x}px`);
  assert.equal(app.dot.style.top, `${at.y}px`);
});

// The pointer is its own marker, and a second one beside it reads as a second cell.
test('the pointer takes the mark off the drawing, and an empty square takes both', () => {
  const app = harness();
  press(app, 'ArrowRight');
  ui.hover(app, pointOnACell());
  assert.equal(app.dot.hidden, true);
  assert.equal(app.tip.hidden, false);
  ui.hover(app, EMPTY_POINT);
  assert.equal(app.dot.hidden, true);
  assert.equal(app.tip.hidden, true);
});

// A step is a step. When the square next door is empty the cursor takes the nearest filled
// one, and "nearest" has to mean nearest — a search that gave up on that would teleport the
// cursor across the state on one key press.
test('arrow keys walk the cursor one square at a time, and each step lands on a cell', () => {
  const app = harness();
  press(app, 'ArrowRight');
  let from = app.cursor;
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) {
    press(app, key);
    const moved = Math.max(Math.abs(app.cursor.col - from.col), Math.abs(app.cursor.row - from.row));
    assert.ok(moved <= 2, `${key} moved the cursor ${moved} squares`);
    assert.notEqual(model.severityAt(GRID, app.cursor), model.EMPTY);
    from = app.cursor;
  }
});

test('a step into empty ground takes the nearest filled square, not any filled square', () => {
  const app = harness();
  // Walk west until the cursor is at the rim of the coverage, where the next square is empty.
  press(app, 'ArrowLeft');
  for (let i = 0; i < 60; i++) {
    const before = app.cursor;
    press(app, 'ArrowLeft');
    const moved = Math.max(Math.abs(app.cursor.col - before.col), Math.abs(app.cursor.row - before.row));
    assert.ok(moved <= 2, `a step west moved the cursor ${moved} squares`);
  }
  assert.notEqual(model.severityAt(GRID, app.cursor), model.EMPTY);
});

test('the keyboard zooms about the middle and zero puts the state back in frame', () => {
  const app = harness();
  press(app, '+');
  press(app, '=');
  assert.ok(app.view.scale > 1);
  press(app, '-');
  const stepped = app.view.scale;
  press(app, '0');
  assert.deepEqual(app.view, { scale: 1, x: 0, y: 0 });
  assert.ok(stepped > 1 && stepped < model.MAX_ZOOM);
});

test('a key the map does not use is left to the page', () => {
  const app = harness();
  const e = event({ x: 0, y: 0 }, { key: 'Tab' });
  ui.key(app, e);
  assert.equal(e.prevented, 0);
  assert.equal(e.stopped, 0);
  assert.equal(app.cursor, null);
});

// The carousel that holds this map pages on ArrowLeft and ArrowRight, so a key that walks
// the cursor must not also reach it.
test('a key the map answers never reaches the carousel underneath it', () => {
  const app = harness();
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', '+', '-', '0']) {
    const e = event({ x: 0, y: 0 }, { key });
    ui.key(app, e);
    assert.equal(e.stopped, 1, `${key} bubbled out of the map`);
    assert.equal(e.prevented, 1, `${key} was left to the browser`);
  }
});

test('the cursor keeps itself in the box when the map is zoomed in', () => {
  const app = harness();
  press(app, 'ArrowRight');
  for (let i = 0; i < 6; i++) press(app, '+');
  for (let i = 0; i < 30; i++) press(app, 'ArrowRight');
  const at = cursorAt(app);
  assert.ok(at.x >= 0 && at.x <= BOX.width, `cursor sits at x=${at.x}`);
  assert.ok(at.y >= 0 && at.y <= BOX.height, `cursor sits at y=${at.y}`);
});

test('leaving the map keeps the keyboard readout, and blurring drops it', () => {
  const app = harness();
  press(app, 'ArrowRight');
  ui.hover(app, EMPTY_POINT);
  assert.equal(app.tip.hidden, true);
  app.map.listeners.get('pointerleave')();
  assert.equal(app.tip.hidden, false, 'the cursor readout did not come back');
  assert.equal(app.dot.hidden, false, 'the cursor mark did not come back');
  app.map.listeners.get('blur')();
  assert.equal(app.cursor, null);
  assert.equal(app.tip.hidden, true);
  assert.equal(app.dot.hidden, true);
});
