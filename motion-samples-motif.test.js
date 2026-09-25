// Studies 07 and 08 of the motion reel: the ellipsis-into-line mark.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./test/page-harness');
const { studiesDraw } = require('./test/canvas-ink');

test('motion-samples.html: the mark, across and down, draw, and each one changes as it is scrubbed', async (t) => {
  const { page, errors } = await openPage(t, { url: 'motion-samples.html', width: 1280 });
  assert.deepEqual(await studiesDraw(page, [7, 8]), {
    7: { drawn: true, moves: true, tv: '100%' },
    8: { drawn: true, moves: true, tv: '100%' },
  });
  assert.deepEqual(errors, []);
});
