// Drawings 06 to 11 of the scroll study: the motion reel, driven by scroll position in a real Chrome.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./test/page-harness');
const { scrollDraws } = require('./test/canvas-ink');

const REEL = ['c-one', 'c-many', 'c-field', 'c-depth', 'c-gate', 'c-aurora'];

test('scroll.html: each reel drawing paints in view and moves on as the page scrolls', async (t) => {
  const { page, errors } = await openPage(t, { url: 'scroll.html', width: 1280 });
  const want = Object.fromEntries(REEL.map((id) => [id, { drawn: true, moves: true }]));
  assert.deepEqual(await scrollDraws(page, REEL), want);
  assert.deepEqual(errors, []);
});
