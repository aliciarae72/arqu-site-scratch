const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector } = require('./test/page-harness');

// width of the inked region on a card canvas, as a share of the canvas width
function inkSpread(page, art) {
  return page.evaluate((kind) => {
    const cv = document.querySelector(`canvas[data-art="${kind}"]`);
    const { data, width, height } = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    let min = width;
    let max = -1;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 60) {
          min = Math.min(min, x);
          max = Math.max(max, x);
        }
      }
    }
    return max < 0 ? 0 : (max - min) / width;
  }, art);
}

async function hover(page, selector, ms) {
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
  await page.waitForTimeout(ms);
}

test('hovering Open market opens its one dot out across the card', async (t) => {
  const { page, errors } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await hover(page, '#way-market', 2500);
  assert.ok((await inkSpread(page, 'market')) > 0.5);
  assert.deepEqual(errors, []);
});

test('hovering Programs closes its dots into one', async (t) => {
  const { page } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await hover(page, '#way-programs', 3500);
  const spread = await inkSpread(page, 'programs');
  assert.ok(spread > 0.01 && spread < 0.15, `programs ink spans ${spread} of the card`);
});

test('left alone, the art keeps moving', async (t) => {
  const { page } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await page.mouse.move(5, 5);
  const frame = () => page.evaluate(() => document.querySelector('canvas[data-art="market"]').toDataURL());
  const first = await frame();
  await page.waitForTimeout(700);
  assert.notEqual(await frame(), first);
});
