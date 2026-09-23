const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector, settle } = require('./test/page-harness');

test('the rail has one dot per section, placed top to bottom, under the header', async (t) => {
  const { page, errors } = await openHome(t);
  await page.waitForTimeout(400);
  const rail = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.sdot')].map((d) => d.getAttribute('aria-label')),
    ys: [...document.querySelectorAll('.sdot')].map((d) => parseFloat(d.style.getPropertyValue('--y'))),
    spineTop: document.getElementById('spine').getBoundingClientRect().top,
    headerBottom: document.querySelector('.top').getBoundingClientRect().bottom,
  }));
  assert.deepEqual(rail.labels, ['Start', 'Values', 'Ways to work', 'Human-centered', 'Get in touch', 'Careers']);
  rail.ys
    .slice(1)
    .forEach((y, i) => assert.ok(y > rail.ys[i], `dot ${i + 1} at ${y} is not below dot ${i} at ${rail.ys[i]}`));
  assert.ok(rail.spineTop > rail.headerBottom);
  assert.deepEqual(errors, []);
});

test('scrolling marks the section in view as current and reveals its content', async (t) => {
  const { page } = await openHome(t);
  await scrollToSelector(page, '#values', 0);
  const state = await settle(
    () =>
      page.evaluate(() => ({
        current: document.querySelector('.sdot[aria-current="true"]')?.getAttribute('aria-label'),
        seen: document.querySelector('.val').classList.contains('seen'),
      })),
    (s) => s.current === 'Values' && s.seen,
  );
  assert.equal(state.current, 'Values');
  assert.equal(state.seen, true);
});

test('clicking a rail dot scrolls to its section', async (t) => {
  const { page } = await openHome(t);
  await page.waitForTimeout(400);
  await page.click('.sdot[aria-label="Human-centered"]');
  const top = await settle(
    () => page.evaluate(() => document.getElementById('human').getBoundingClientRect().top),
    (y) => Math.abs(y) < 120,
  );
  assert.ok(Math.abs(top) < 120, `human section top is ${top}px from the viewport top`);
});

test('content below the fold stays unrevealed until it is scrolled to', async (t) => {
  const { page } = await openHome(t);
  await page.waitForTimeout(3000);
  assert.equal(await page.evaluate(() => document.querySelector('.g-note').classList.contains('seen')), false);
  await scrollToSelector(page, '.g-note', 300);
  assert.equal(
    await settle(
      () => page.evaluate(() => document.querySelector('.g-note').classList.contains('seen')),
      (seen) => seen,
    ),
    true,
  );
});
