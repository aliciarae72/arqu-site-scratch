const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector } = require('./test/page-harness');

async function pointAt(page, fx, fy) {
  const box = await (await page.$('.rn-slide.is-on .rn-vis')).boundingBox();
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
  return page.evaluate(() => document.querySelector('.rn-slide.is-on .rn-live').textContent);
}

async function openSlideshow(t) {
  const opened = await openHome(t, { query: '?open=market' });
  await scrollToSelector(opened.page, '[data-rn-show]');
  await opened.page.waitForTimeout(900);
  return opened;
}

test('wildfire measures distance from the site against the 2.5 mile fire edge', async (t) => {
  const { page, errors } = await openSlideshow(t);
  // the site sits at (240, 176) of a 480x360 map drawn 50 units to the mile
  assert.equal(await pointAt(page, 290 / 480, 176 / 360), '1.0 mi from the siteCloser than any fire on record');
  assert.equal(await pointAt(page, 390 / 480, 176 / 360), '3.0 mi from the sitePast where the closest fire stopped');
  assert.deepEqual(errors, []);
});

test('seismic reads a magnitude against the largest event on record, ten times per step', async (t) => {
  const { page } = await openSlideshow(t);
  await page.click('[data-rn-next]');
  await page.waitForTimeout(600);
  // M0 at x=40, 80 units per magnitude: x=40+80*3.43 is one whole step above M2.43
  // a pointer lands to the nearest pixel, so allow the ratio to round either side of ten
  assert.match(
    await pointAt(page, (40 + 80 * 3.43) / 480, 0.5),
    /^M3\.4~(9\.\d|10|11)× the ground motion of the largest on record$/,
  );
  assert.match(
    await pointAt(page, (40 + 80 * 1.43) / 480, 0.5),
    /^M1\.4~1\/(9|10|11) the ground motion of the largest on record$/,
  );
});

test('loss history totals the years and each bar selects its own year', async (t) => {
  const { page } = await openSlideshow(t);
  await page.click('.rn-pip[aria-label="Loss history"]');
  assert.equal(await page.textContent('[data-rn-loss-title]'), 'Five years, 7 claims, $368,000 incurred.');
  await page.hover('.rn-bar[data-year="2023"]');
  await page.waitForTimeout(700);
  const read = await page.evaluate(() => ({
    incurred: document.querySelector('[data-rn-incurred]').textContent,
    claims: document.querySelector('[data-rn-claims]').textContent,
    pressed: document.querySelector('.rn-bar[aria-pressed="true"]').dataset.year,
    label: document.querySelector('.rn-bar[data-year="2023"]').getAttribute('aria-label'),
    heights: [...document.querySelectorAll('.rn-bar')].map((b) => b.style.getPropertyValue('--h')),
  }));
  // 2023 is the peak year, so it is the full-height bar and the others scale against it
  assert.deepEqual(read, {
    incurred: '$212,000',
    claims: '3',
    pressed: '2023',
    label: '2023: $212,000 incurred, 3 claims',
    heights: ['2', '23', '100', '45', '6'],
  });
});
