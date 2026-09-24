// Drawings 00 to 05 of the scroll study, driven by scroll position in a real Chrome.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./test/page-harness');
const { scrollDraws } = require('./test/canvas-ink');

const STORY = ['c-open', 'c-arrives', 'c-market', 'c-tower', 'c-human', 'c-line'];

test('scroll.html: each story drawing paints in view and moves on as the page scrolls', async (t) => {
  const { page, errors } = await openPage(t, { url: 'scroll.html', width: 1280 });
  const want = Object.fromEntries(STORY.map((id) => [id, { drawn: true, moves: true }]));
  assert.deepEqual(await scrollDraws(page, STORY), want);
  assert.deepEqual(errors, []);
});
