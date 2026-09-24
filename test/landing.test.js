const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector, settle } = require('./page-harness');

for (const [card, page, flow] of [
  ['#way-market', 'open-market.html', '#flow-market'],
  ['#way-programs', 'programs.html', '#flow-programs'],
]) {
  test(`the ${card} card opens ${page} with its flow showing`, async (t) => {
    const { page: tab, errors } = await openPage(t);
    await scrollToSelector(tab, '.way-grid', 160);
    await Promise.all([tab.waitForURL(`**/${page}`), tab.click(card)]);
    await tab.waitForSelector(flow, { state: 'visible' });
    assert.equal(await tab.title(), `arqu — ${page === 'programs.html' ? 'Programs' : 'Open market'}`);
    await Promise.all([tab.waitForURL('**/home.html'), tab.click('a.back')]);
    assert.deepEqual(errors, []);
  });
}

test('old home.html deep links land on the page that now holds their flow', async (t) => {
  const { page: tab } = await openPage(t);
  const origin = new URL(tab.url()).origin;
  const landed = {};
  for (const link of ['?open=market', '?open=programs', '#flow-market', '#way-programs', '#ways']) {
    await tab.goto('about:blank');
    await tab.goto(`${origin}/home.html${link}`);
    await tab.waitForSelector('.top');
    landed[link] = new URL(tab.url()).pathname.slice(1);
  }
  assert.deepEqual(landed, {
    '?open=market': 'open-market.html',
    '?open=programs': 'programs.html',
    '#flow-market': 'open-market.html',
    '#way-programs': 'programs.html',
    '#ways': 'home.html',
  });
});

test('the hero mark sits above the copy, draws in once on load, then holds still', async (t) => {
  const { page, errors } = await openPage(t);
  const read = () =>
    page.evaluate(() => {
      const mark = document.querySelector('#intro .motif');
      const run = mark.querySelector('.motif-run');
      const box = run.getBoundingClientRect();
      const dots = [...mark.querySelectorAll('i')].map((i) => i.getBoundingClientRect());
      const names = (el) => el.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().iterations]);
      return {
        hidden: mark.getAttribute('aria-hidden'),
        dots: dots.length,
        dotsFirst: dots.every((d) => d.right < box.left),
        aboveCopy:
          mark.getBoundingClientRect().bottom < document.querySelector('#intro .g-kicker').getBoundingClientRect().top,
        stroke: getComputedStyle(run).height,
        reachesEdge: box.right >= document.documentElement.clientWidth,
        scrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        runAnimations: names(run),
        dotAnimations: names(mark.querySelector('i')),
      };
    });
  assert.deepEqual(await settle(read, (m) => m.runAnimations.length === 1), {
    hidden: 'true',
    dots: 3,
    dotsFirst: true,
    aboveCopy: true,
    stroke: '1px',
    reachesEdge: true,
    scrollsSideways: false,
    runAnimations: [['mo-draw', 1]],
    dotAnimations: [['mo-dot', 1]],
  });
  assert.deepEqual(errors, []);
});
