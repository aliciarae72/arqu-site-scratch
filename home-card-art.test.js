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

// The art eases toward its end state on requestAnimationFrame, so a slow runner gets there
// later; sample until the spread satisfies `done` or the deadline passes, and return the last one.
async function settledSpread(page, art, done, deadline = 12000) {
  const end = Date.now() + deadline;
  let spread = await inkSpread(page, art);
  while (!done(spread) && Date.now() < end) {
    await page.waitForTimeout(250);
    spread = await inkSpread(page, art);
  }
  return spread;
}

async function hover(page, selector) {
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
}

test('hovering Open market opens its one dot out across the card', async (t) => {
  const { page, errors } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await hover(page, '#way-market');
  assert.ok((await settledSpread(page, 'market', (x) => x > 0.5)) > 0.5);
  assert.deepEqual(errors, []);
});

test('hovering Programs closes its dots into one', async (t) => {
  const { page } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await hover(page, '#way-programs');
  const spread = await settledSpread(page, 'programs', (x) => x > 0.01 && x < 0.15);
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
