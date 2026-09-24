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
      await tab.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 1200);
      });
      assert.deepEqual(await barCollisions(tab), []);
      const [scroll, client] = await tab.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      assert.equal(scroll, client, `${page} scrolls ${scroll - client}px sideways at ${width}`);
      // main clips its overflow, so the scroll check above only sees the header and footer.
      // Every text block and figure on the page is measured against the viewport edge too.
      const offEdge = await tab.evaluate(() =>
        [...document.querySelectorAll('h1, h2, h3, p, li, figure, a')]
          .filter((el) => el.getBoundingClientRect().width && el.getBoundingClientRect().right > innerWidth + 1)
          .map((el) => el.textContent.trim().slice(0, 40)),
      );
      assert.deepEqual(offEdge, [], `${page} runs past the right edge at ${width}`);
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

for (const width of [1440, 390]) {
  test(`open-market.html at ${width}: every slide figure is one fixed height, with nothing cut off`, async (t) => {
    const { page } = await openPage(t, { url: 'open-market.html', width });
    const figures = await page.evaluate(() =>
      [...document.querySelectorAll('.rn-vis--figure > figure')].map((f) => ({
        height: Math.round(f.getBoundingClientRect().height),
        clipped: f.scrollHeight > f.clientHeight + 1,
      })),
    );
    const want = width === 1440 ? 600 : 520;
    assert.deepEqual(figures, [
      { height: want, clipped: false },
      { height: want, clipped: false },
    ]);
  });
}

test('programs.html: "today" is the quieter panel, "inside a program" the raised card', async (t) => {
  const { page } = await openPage(t, { url: 'programs.html' });
  const panels = await page.evaluate(() =>
    [...document.querySelectorAll('.audiences .how')].map((p) => {
      const cs = getComputedStyle(p);
      return { border: cs.borderTopStyle, raised: cs.boxShadow !== 'none' };
    }),
  );
  assert.deepEqual(panels, [
    { border: 'dashed', raised: false },
    { border: 'solid', raised: true },
  ]);
});

test('open-market.html: the hero bars grow in, then the highlight moves from year to year', async (t) => {
  const { page, errors } = await openPage(t, { url: 'open-market.html' });
  const lit = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.rh-col i')].findIndex(
        (bar) => getComputedStyle(bar).backgroundColor === 'rgb(94, 84, 200)',
      ),
    );
  const grown = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.rh-col i')];
    return bars.length === 5 && bars.every((bar) => bar.getAnimations().some((a) => a.animationName === 'rh-grow'));
  });
  assert.ok(grown, 'a hero bar does not grow in');
  const seen = new Set();
  const end = Date.now() + 6000;
  while (Date.now() < end && seen.size < 2) {
    const i = await lit();
    if (i >= 0) seen.add(i);
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(seen.size >= 2, `the highlight only ever lit bar ${[...seen]}`);
  assert.deepEqual(errors, []);
});
