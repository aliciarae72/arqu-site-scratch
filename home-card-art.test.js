const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector, settle } = require('./test/page-harness');

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

async function hover(page, selector) {
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
}

test('hovering Open market opens its one dot out across the card', async (t) => {
  const { page, errors } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await hover(page, '#way-market');
  assert.ok(
    (await settle(
      () => inkSpread(page, 'market'),
      (x) => x > 0.5,
    )) > 0.5,
  );
  assert.deepEqual(errors, []);
});

test('hovering Programs closes its dots into one', async (t) => {
  const { page } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await hover(page, '#way-programs');
  const spread = await settle(
    () => inkSpread(page, 'programs'),
    (x) => x > 0.01 && x < 0.15,
  );
  assert.ok(spread > 0.01 && spread < 0.15, `programs ink spans ${spread} of the card`);
});

test('left alone, the art keeps moving', async (t) => {
  const { page } = await openHome(t);
  await scrollToSelector(page, '.way-grid', 160);
  await page.mouse.move(5, 5);
  const frame = () => page.evaluate(() => document.querySelector('canvas[data-art="market"]').toDataURL());
  const blank = await page.evaluate(() => {
    const cv = document.querySelector('canvas[data-art="market"]');
    const c = document.createElement('canvas');
    c.width = cv.width;
    c.height = cv.height;
    return c.toDataURL();
  });
  const first = await settle(frame, (f) => f !== blank);
  assert.notEqual(first, blank, 'market art never painted');
  assert.notEqual(await settle(frame, (f) => f !== first, 3000), first);
});

test('under reduced motion, a resize re-settles the art to fit the new card', async (t) => {
  const { page } = await openHome(t, { width: 390 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await scrollToSelector(page, '.way-grid', 160);
  const canvasWidth = () => page.evaluate(() => document.querySelector('canvas[data-art="market"]').width);
  const narrow = await canvasWidth();
  await page.setViewportSize({ width: 1440, height: 900 });
  const wide = await settle(canvasWidth, (w) => w > narrow * 1.2);
  assert.ok(wide > narrow * 1.2, `the card canvas did not widen: ${narrow} to ${wide}`);
  const centre = () =>
    page.evaluate(() => {
      const cv = document.querySelector('canvas[data-art="market"]');
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
      return max < 0 ? -1 : (min + max) / 2 / width;
    });
  const c = await settle(centre, (x) => Math.abs(x - 0.5) < 0.12);
  assert.ok(Math.abs(c - 0.5) < 0.12, `market ink is centred at ${c} of the resized card`);
});
