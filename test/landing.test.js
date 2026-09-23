const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector } = require('./page-harness');

for (const [card, page, flow] of [
  ['#way-market', 'open-market.html', '#flow-market'],
  ['#way-programs', 'programs.html', '#flow-programs'],
]) {
  test(`the ${card} card opens ${page} with its flow showing`, async (t) => {
    const { page: tab, errors } = await openHome(t);
    await scrollToSelector(tab, '.way-grid', 160);
    await Promise.all([tab.waitForURL(`**/${page}`), tab.click(card)]);
    await tab.waitForSelector(`${flow} .node`, { state: 'visible' });
    assert.equal(await tab.title(), `arqu — ${page === 'programs.html' ? 'Programs' : 'Open market'}`);
    await Promise.all([tab.waitForURL('**/home.html'), tab.click('a.back')]);
    assert.deepEqual(errors, []);
  });
}

for (const [link, page] of [
  ['?open=market', 'open-market.html'],
  ['?open=programs', 'programs.html'],
  ['#flow-market', 'open-market.html'],
  ['#way-programs', 'programs.html'],
]) {
  test(`an old home.html${link} link lands on ${page}`, async (t) => {
    const { page: tab } = await openHome(t, { query: link });
    await tab.waitForURL(`**/${page}`);
    assert.ok(new URL(tab.url()).pathname.endsWith(`/${page}`));
  });
}

test('home.html#ways stays on the landing page', async (t) => {
  const { page: tab } = await openHome(t, { query: '#ways' });
  await tab.waitForSelector('#way-market');
  assert.ok(new URL(tab.url()).pathname.endsWith('/home.html'));
});
