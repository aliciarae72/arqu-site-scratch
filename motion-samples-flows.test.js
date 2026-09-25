// Studies 01 to 06 of the motion reel, drawn in a real Chrome.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./test/page-harness');
const { studiesDraw } = require('./test/canvas-ink');

test('motion-samples.html: how a risk and a book move draw, and each one changes as it is scrubbed', async (t) => {
  const { page, errors } = await openPage(t, { url: 'motion-samples.html', width: 1280 });
  assert.deepEqual(await studiesDraw(page, [1, 2, 3, 4, 5, 6]), {
    1: { drawn: true, moves: true, tv: '100%' },
    2: { drawn: true, moves: true, tv: '100%' },
    3: { drawn: true, moves: true, tv: '100%' },
    4: { drawn: true, moves: true, tv: '100%' },
    5: { drawn: true, moves: true, tv: '100%' },
    6: { drawn: true, moves: true, tv: '100%' },
  });
  assert.deepEqual(errors, []);
});
