const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector } = require('./test/page-harness');

test('the hero draws the ask and the arrow back to it, and marks no word in the title', async (t) => {
  const { page, errors } = await openHome(t);
  await page.waitForTimeout(3500);
  const hero = await page.evaluate(() => ({
    titleMarks: document.querySelectorAll('#hand > g').length,
    motifStrokes: document.querySelectorAll('.hand-motif path').length,
    inked: [...document.querySelectorAll('.hand-motif path')]
      .filter((p) => p.getAttribute('stroke') !== 'none')
      .every((p) => p.style.strokeDashoffset === '0'),
  }));
  assert.deepEqual(hero, { titleMarks: 0, motifStrokes: 3, inked: true });
  assert.deepEqual(errors, []);
});

test('marks further down only draw once scrolled into view', async (t) => {
  const { page } = await openHome(t);
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => document.querySelectorAll('#hand > g').length);
  await scrollToSelector(page, '#values', 0);
  await page.waitForTimeout(2000);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#hand > g').length), before + 1);
});

test('the hero and the cards follow the pointer', async (t) => {
  const { page } = await openHome(t);
  await page.mouse.move(1300, 300);
  const px = await page.evaluate(() => document.querySelector('.motif').style.getPropertyValue('--px'));
  assert.ok(+px > 0, `--px is ${px}`);
  await scrollToSelector(page, '.way-grid', 160);
  const box = await (await page.$('#way-programs')).boundingBox();
  await page.mouse.move(box.x + 40, box.y + 30);
  assert.equal(
    await page.evaluate(() => document.getElementById('way-programs').style.getPropertyValue('--mx')),
    '40px',
  );
});
