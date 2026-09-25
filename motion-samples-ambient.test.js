// Studies 09 to 11 of the motion reel: the ambient backgrounds.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./test/page-harness');
const { studiesDraw } = require('./test/canvas-ink');

test('motion-samples.html: the ambient fields draw, and each one changes as it is scrubbed', async (t) => {
  const { page, errors } = await openPage(t, { url: 'motion-samples.html', width: 1280 });
  assert.deepEqual(await studiesDraw(page, [9, 10, 11]), {
    9: { drawn: true, moves: true, tv: '100%' },
    10: { drawn: true, moves: true, tv: '100%' },
    11: { drawn: true, moves: true, tv: '100%' },
  });
  assert.deepEqual(errors, []);
});
