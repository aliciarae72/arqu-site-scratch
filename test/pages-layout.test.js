const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./page-harness');

const PAGES = ['home.html', 'programs.html', 'open-market.html'];

// Every box the editing bar overlaps, among the header button, the mockup flag and the logo.
function barCollisions(page) {
  return page.evaluate(() => {
    const bar = document.getElementById('edbar').getBoundingClientRect();
    return ['.top .btn', '.flag', '.top .mark']
      .map((sel) => [sel, document.querySelector(sel).getBoundingClientRect()])
      .filter(
        ([, r]) => r.width && bar.left < r.right && bar.right > r.left && bar.top < r.bottom && bar.bottom > r.top,
      )
      .map(([sel]) => sel);
  });
}

for (const page of PAGES) {
  for (const width of [1440, 390]) {
    test(`${page} at ${width}: the editing bar covers neither the header nor the flag, and nothing scrolls sideways`, async (t) => {
      const { page: tab, errors } = await openPage(t, { url: page, width });
      await tab.waitForSelector('#edbar');
      assert.deepEqual(await barCollisions(tab), []);
      // the sticky header rides along, so check it again part-way down the page
      await tab.evaluate(() => window.scrollTo(0, 1200));
      assert.deepEqual(await barCollisions(tab), []);
      const [scroll, client] = await tab.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      assert.equal(scroll, client, `${page} scrolls ${scroll - client}px sideways at ${width}`);
      assert.deepEqual(errors, []);
    });
  }
}

test('open-market.html: in Edit copy mode the risk-narrative heading and lede take typing', async (t) => {
  const { page, errors } = await openPage(t, { url: 'open-market.html' });
  await page.click('#edtoggle');
  const editable = await page.evaluate(() =>
    ['.rn-head h3', '.rn-lede'].map((sel) => document.querySelector(sel).isContentEditable),
  );
  assert.deepEqual(editable, [true, true]);
  await page.click('.rn-head h3');
  await page.keyboard.type(' Edited.');
  assert.match(await page.textContent('.rn-head h3'), / Edited\./);
  assert.deepEqual(errors, []);
});

test('open-market.html: on every slide the read sits right above its visual', async (t) => {
  const { page } = await openPage(t, { url: 'open-market.html' });
  const gaps = await page.evaluate(() =>
    [...document.querySelectorAll('.rn-slide')].map((s) => {
      const read = s.querySelector('.rn-say').getBoundingClientRect();
      return s.querySelector('.rn-vis').getBoundingClientRect().top - read.bottom;
    }),
  );
  gaps.forEach((gap, i) => {
    assert.ok(gap >= 0 && gap < 40, `slide ${i + 1}: ${gap}px between its read and its visual`);
  });
});
