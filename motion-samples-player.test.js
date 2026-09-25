// The motion reel's shared player: Replay, the scrubber and the percent readout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('./test/page-harness');
const { centre } = require('./test/canvas-ink');

test('motion-samples.html: Replay runs a panel from the start to 100% and stops there', async (t) => {
  const { page, errors } = await openPage(t, { url: 'motion-samples.html', width: 1280 });
  await centre(page, 'c1');
  await page.click('[data-play="1"]');
  const early = Number.parseInt(await page.textContent('[data-tv="1"]'), 10);
  assert.ok(early < 60, `Replay did not start over (${early}%)`);
  const end = await settle(
    () => page.textContent('[data-tv="1"]'),
    (tv) => tv === '100%',
  );
  assert.equal(end, '100%');
  assert.equal(await page.inputValue('[data-scrub="1"]'), '1000');
  assert.deepEqual(errors, []);
});

test('motion-samples.html: the scrubber sets a panel to that moment and holds it there', async (t) => {
  const { page } = await openPage(t, { url: 'motion-samples.html', width: 1280 });
  await centre(page, 'c9');
  await page.fill('[data-scrub="9"]', '420');
  await page.waitForTimeout(400);
  assert.equal(await page.textContent('[data-tv="9"]'), '42%');
});
