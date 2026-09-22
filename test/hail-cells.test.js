// Unit checks for scripts/hail-cells.js. The counts come from the shipped NOAA extract
// rather than a fixture, so a re-extract that moves them fails here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const cells = require('../scripts/hail-cells.js');

const DATA = JSON.parse(readFileSync(join(__dirname, '..', 'data/hail-severity.json'), 'utf8'));
const COLORADO = require('../hail-grid.js').frame;

test('boxOf reads a ring back as its extent and its centre', () => {
  // A flat-top hexagon, listed anticlockwise from its east vertex.
  const hexagon = [
    [-108.0, 37.0],
    [-108.01, 37.01],
    [-108.03, 37.01],
    [-108.04, 37.0],
    [-108.03, 36.99],
    [-108.01, 36.99],
  ];
  const box = cells.boxOf(hexagon);
  assert.equal(box.width.toFixed(4), '0.0400');
  assert.equal(box.height.toFixed(4), '0.0200');
  assert.equal(box.lon.toFixed(4), '-108.0200');
  assert.equal(box.lat.toFixed(4), '37.0000');
});

test('boxOf survives a ring of one point', () => {
  assert.deepEqual(cells.boxOf([[-105, 39]]), { width: 0, height: 0, lon: -105, lat: 39 });
});

test('inFrame takes a centre on the line and refuses one past it', () => {
  const frame = { west: -109, east: -102, south: 37, north: 41 };
  const at = (lon, lat) => cells.inFrame(frame, { lon, lat });
  assert.equal(at(-105, 39), true, 'the middle of the frame');
  assert.equal(at(-109, 37), true, 'the south-west corner is inside');
  assert.equal(at(-102, 41), true, 'the north-east corner is inside');
  assert.equal(at(-109.01, 39), false, 'west of the line');
  assert.equal(at(-101.99, 39), false, 'east of the line');
  assert.equal(at(-105, 36.99), false, 'south of the line');
  assert.equal(at(-105, 41.01), false, 'north of the line');
});

test('drawnCells keeps the cells inside the frame and drops the rest', () => {
  const drawn = cells.drawnCells(COLORADO, DATA.cells);
  assert.equal(drawn.length, 11026);
  assert.ok(drawn.length < DATA.cells.length, 'the extract runs past the state line');
  for (const [, ring] of drawn) {
    assert.equal(cells.inFrame(COLORADO, cells.boxOf(ring)), true);
  }
});

test('drawnCells drops exactly the cells centred outside, and keeps their severities', () => {
  const drawn = cells.drawnCells(COLORADO, DATA.cells);
  const dropped = DATA.cells.length - drawn.length;
  assert.equal(dropped, 937);
  for (const [, ring] of DATA.cells) {
    if (cells.inFrame(COLORADO, cells.boxOf(ring))) continue;
    assert.equal(
      drawn.some(([, kept]) => kept === ring),
      false,
      'a cell outside the frame was drawn',
    );
  }
  const tally = {};
  for (const [severity] of drawn) tally[DATA.categories[severity]] = (tally[DATA.categories[severity]] || 0) + 1;
  assert.deepEqual(tally, { 'Very Low': 9648, Low: 1168, Moderate: 169, High: 40, 'Very High': 1 });
});

test('a frame nothing sits inside draws nothing', () => {
  const elsewhere = { west: 10, east: 20, south: 10, north: 20 };
  assert.deepEqual(cells.drawnCells(elsewhere, DATA.cells), []);
});
