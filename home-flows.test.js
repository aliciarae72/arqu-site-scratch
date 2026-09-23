const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome } = require('./test/page-harness');

test('opening Open market shows its flow, dims Programs, and lands the wire on the first dot', async (t) => {
  const { page, errors } = await openHome(t);
  await page.click('#way-market');
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => {
    const path = document.querySelector('#flow-market .wire path').getAttribute('d');
    const box = document.querySelector('#flow-market .wire').getBoundingClientRect();
    const node = document.querySelector('#flow-market .node').getBoundingClientRect();
    const ends = [...path.matchAll(/H([\d.]+) V56/g)].map((m) => box.left + (+m[1] / 100) * box.width);
    return {
      expanded: document.querySelector('#way-market').getAttribute('aria-expanded'),
      flowHidden: document.querySelector('#flow-market').hidden,
      programsDim: document.querySelector('#way-programs').classList.contains('dim'),
      firstDotX: node.left + 2.5,
      wireEnds: ends,
    };
  });
  assert.equal(state.expanded, 'true');
  assert.equal(state.flowHidden, false);
  assert.equal(state.programsDim, true);
  assert.ok(
    Math.abs(state.wireEnds[0] - state.firstDotX) < 1.5,
    `wire lands at ${state.wireEnds[0]}, dot at ${state.firstDotX}`,
  );
  assert.deepEqual(errors, []);
});

test('clicking the open card again closes the flow', async (t) => {
  const { page } = await openHome(t, { query: '?open=programs' });
  assert.equal(await page.getAttribute('#way-programs', 'aria-expanded'), 'true');
  await page.click('#way-programs');
  assert.equal(await page.getAttribute('#way-programs', 'aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.querySelector('#flow-programs').hidden), true);
});
