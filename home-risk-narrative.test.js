const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector } = require('./test/page-harness');

async function slideState(page) {
  return page.evaluate(() => ({
    on: [...document.querySelectorAll('.rn-slide')].findIndex((s) => s.classList.contains('is-on')),
    count: document.querySelector('[data-rn-count]').textContent,
    pip: [...document.querySelectorAll('.rn-pip')].findIndex((p) => p.getAttribute('aria-selected') === 'true'),
    inert: [...document.querySelectorAll('.rn-slide')].map((s) => s.inert),
  }));
}

test('arrows move one slide at a time and wrap around', async (t) => {
  const { page, errors } = await openHome(t, { query: '?open=market' });
  await scrollToSelector(page, '[data-rn]');
  await page.click('[data-rn-next]');
  assert.deepEqual(await slideState(page), { on: 1, count: '02 / 03 · Seismic', pip: 1, inert: [true, false, true] });
  await page.click('[data-rn-prev]');
  await page.click('[data-rn-prev]');
  assert.deepEqual(await slideState(page), {
    on: 2,
    count: '03 / 03 · Loss history',
    pip: 2,
    inert: [true, true, false],
  });
  assert.deepEqual(errors, []);
});

test('pips jump straight to a slide and arrow keys move it', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  await scrollToSelector(page, '[data-rn]');
  await page.click('.rn-pip[aria-label="Loss history"]');
  assert.equal((await slideState(page)).on, 2);
  await page.focus('[data-rn-show]');
  await page.keyboard.press('ArrowRight');
  assert.equal((await slideState(page)).on, 0);
  await page.keyboard.press('ArrowLeft');
  assert.equal((await slideState(page)).on, 2);
});

test('the first slide animates in once the slideshow is on screen', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  assert.equal(await page.evaluate(() => document.querySelectorAll('.rn-vis.in').length), 0);
  await scrollToSelector(page, '[data-rn-show]');
  await page.waitForTimeout(900);
  assert.equal(
    await page.evaluate(() => document.querySelector('.rn-slide.is-on .rn-vis').classList.contains('in')),
    true,
  );
});
