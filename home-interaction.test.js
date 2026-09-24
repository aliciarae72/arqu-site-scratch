const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector, settle } = require('./test/page-harness');

test('the rail has one dot per section, placed top to bottom, under the header', async (t) => {
  const { page, errors } = await openPage(t);
  const placed = (r) => r.ys.length > 1 && r.ys.every(Number.isFinite) && r.spineTop > r.headerBottom;
  const rail = await settle(
    () =>
      page.evaluate(() => ({
        labels: [...document.querySelectorAll('.sdot')].map((d) => d.getAttribute('aria-label')),
        ys: [...document.querySelectorAll('.sdot')].map((d) => parseFloat(d.style.getPropertyValue('--y'))),
        spineTop: document.getElementById('spine').getBoundingClientRect().top,
        headerBottom: document.querySelector('.top').getBoundingClientRect().bottom,
      })),
    placed,
  );
  assert.deepEqual(rail.labels, ['Welcome', 'Ways to work', 'Get in touch', 'Careers']);
  rail.ys
    .slice(1)
    .forEach((y, i) => assert.ok(y > rail.ys[i], `dot ${i + 1} at ${y} is not below dot ${i} at ${rail.ys[i]}`));
  assert.ok(rail.spineTop > rail.headerBottom);
  assert.deepEqual(errors, []);
});

test('scrolling marks the section in view as current and reveals its content', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '#ways', 0);
  const state = await settle(
    () =>
      page.evaluate(() => ({
        current: document.querySelector('.sdot[aria-current="true"]')?.getAttribute('aria-label'),
        seen: document.querySelector('.way-grid').classList.contains('seen'),
      })),
    (s) => s.current === 'Ways to work' && s.seen,
  );
  assert.equal(state.current, 'Ways to work');
  assert.equal(state.seen, true);
});

test('clicking a rail dot scrolls to its section', async (t) => {
  const { page } = await openPage(t);
  await page.waitForSelector('.sdot[aria-label="Ways to work"]');
  await page.click('.sdot[aria-label="Ways to work"]');
  const top = await settle(
    () => page.evaluate(() => document.getElementById('ways').getBoundingClientRect().top),
    (y) => Math.abs(y) < 120,
  );
  assert.ok(Math.abs(top) < 120, `ways section top is ${top}px from the viewport top`);
});

test('content below the fold stays unrevealed until it is scrolled to', async (t) => {
  const { page } = await openPage(t);
  await page.waitForTimeout(3000);
  assert.equal(await page.evaluate(() => document.querySelector('.close > div').classList.contains('seen')), false);
  await scrollToSelector(page, '#contact', 300);
  assert.equal(
    await settle(
      () => page.evaluate(() => document.querySelector('.close > div').classList.contains('seen')),
      (seen) => seen,
    ),
    true,
  );
});
