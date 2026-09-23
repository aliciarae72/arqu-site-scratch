const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector, settle } = require('./test/page-harness');

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
  assert.deepEqual(await slideState(page), {
    on: 1,
    count: '02 / 02 · Property and hail',
    pip: 1,
    inert: [true, false],
  });
  await page.click('[data-rn-next]');
  assert.deepEqual(await slideState(page), {
    on: 0,
    count: '01 / 02 · Casualty and energy',
    pip: 0,
    inert: [false, true],
  });
  await page.click('[data-rn-prev]');
  assert.equal((await slideState(page)).on, 1);
  assert.deepEqual(errors, []);
});

test('pips jump straight to a slide and arrow keys move it', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  await scrollToSelector(page, '[data-rn]');
  await page.click('.rn-pip[aria-label="Property and hail"]');
  assert.equal((await slideState(page)).on, 1);
  await page.focus('[data-rn-show]');
  await page.keyboard.press('ArrowRight');
  assert.equal((await slideState(page)).on, 0);
  await page.keyboard.press('ArrowLeft');
  assert.equal((await slideState(page)).on, 1);
});

test('the first slide animates in once the slideshow is on screen', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  assert.equal(await page.evaluate(() => document.querySelectorAll('.rn-vis.in').length), 0);
  await scrollToSelector(page, '[data-rn-show]');
  const entered = await settle(
    () => page.evaluate(() => document.querySelector('.rn-slide.is-on .rn-vis').classList.contains('in')),
    (v) => v,
  );
  assert.equal(entered, true);
});

// Touch contacts dispatched on the slideshow's own text, away from the map that owns its gestures.
function touches(page, contacts) {
  return page.evaluate((list) => {
    const target = document.querySelector('.rn-slide.is-on .rn-title');
    list.forEach(([type, pointerId, clientX]) =>
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId, clientX, clientY: 300 }),
      ),
    );
  }, contacts);
}

test('a one-finger swipe moves to the next slide', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  await scrollToSelector(page, '[data-rn]');
  await touches(page, [
    ['pointerdown', 7, 300],
    ['pointerup', 7, 150],
  ]);
  assert.equal((await slideState(page)).on, 1);
});

test('a second finger landing mid-swipe cancels the swipe', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  await scrollToSelector(page, '[data-rn]');
  await touches(page, [
    ['pointerdown', 7, 300],
    ['pointerdown', 8, 400],
    ['pointerup', 7, 320],
    ['pointerup', 8, 250],
  ]);
  assert.equal((await slideState(page)).on, 0);
});
