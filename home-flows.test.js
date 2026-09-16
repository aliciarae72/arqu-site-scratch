const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome } = require('./test/page-harness');

test('opening Open market shows its flow and dims Programs, with no wire into its columns', async (t) => {
  const { page, errors } = await openHome(t);
  await page.click('#way-market');
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => ({
    expanded: document.querySelector('#way-market').getAttribute('aria-expanded'),
    flowHidden: document.querySelector('#flow-market').hidden,
    programsDim: document.querySelector('#way-programs').classList.contains('dim'),
    wire: !!document.querySelector('#flow-market .wire'),
  }));
  assert.deepEqual(state, { expanded: 'true', flowHidden: false, programsDim: true, wire: false });
  assert.deepEqual(errors, []);
});

test('opening Programs lands its wire on the first dot', async (t) => {
  const { page } = await openHome(t);
  await page.click('#way-programs');
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => {
    const path = document.querySelector('#flow-programs .wire path').getAttribute('d');
    const box = document.querySelector('#flow-programs .wire').getBoundingClientRect();
    const node = document.querySelector('#flow-programs .node').getBoundingClientRect();
    const ends = [...path.matchAll(/H([\d.]+) V56/g)].map((m) => box.left + (+m[1] / 100) * box.width);
    return { firstDotX: node.left + 2.5, wireEnds: ends };
  });
  assert.equal(state.wireEnds.length, 1);
  assert.ok(
    Math.abs(state.wireEnds[0] - state.firstDotX) < 1.5,
    `wire lands at ${state.wireEnds[0]}, dot at ${state.firstDotX}`,
  );
});

test('clicking the open card again closes the flow', async (t) => {
  const { page } = await openHome(t, { query: '?open=programs' });
  assert.equal(await page.getAttribute('#way-programs', 'aria-expanded'), 'true');
  await page.click('#way-programs');
  assert.equal(await page.getAttribute('#way-programs', 'aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.querySelector('#flow-programs').hidden), true);
});
