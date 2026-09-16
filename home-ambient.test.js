const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome } = require('./test/page-harness');

// strongest purple the field has painted inside a square around (x, y), in CSS pixels
function purpleNear(page, x, y, r) {
  return page.evaluate(
    ([cx, cy, rad]) => {
      const cv = document.querySelector('canvas.ambient');
      const k = cv.width / window.innerWidth;
      const px = cv.getContext('2d').getImageData((cx - rad) * k, (cy - rad) * k, 2 * rad * k, 2 * rad * k).data;
      let best = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 2] > px[i] + 60) best = Math.max(best, px[i + 3]);
      }
      return best;
    },
    [x, y, r],
  );
}

test('the field covers the viewport', async (t) => {
  const { page, errors } = await openHome(t);
  const fit = await page.evaluate(() => {
    const cv = document.querySelector('canvas.ambient');
    return cv.width === Math.floor(window.innerWidth * Math.min(2, window.devicePixelRatio || 1));
  });
  assert.equal(fit, true);
  assert.deepEqual(errors, []);
});

test('dots near the pointer lift into purple, dots far away stay ink', async (t) => {
  const { page } = await openHome(t);
  await page.mouse.move(700, 500);
  await page.mouse.move(720, 520, { steps: 5 });
  await page.waitForTimeout(900);
  assert.ok((await purpleNear(page, 720, 520, 60)) > 0);
  assert.equal(await purpleNear(page, 150, 150, 60), 0);
});

test('a click sends a ring out through the field', async (t) => {
  const { page } = await openHome(t);
  await page.mouse.click(300, 700);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);
  // about 0.42px per ms, so roughly 210px out after half a second
  assert.ok((await purpleNear(page, 510, 700, 40)) > 0);
});
