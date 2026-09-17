const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector } = require('./test/page-harness');

test('the hero draws the person holding up their ask', async (t) => {
  const { page, errors } = await openHome(t);
  await page.waitForTimeout(3500);
  const hero = await page.evaluate(() => {
    const strokes = [...document.querySelectorAll('.hand-motif path')].filter(
      (p) => p.getAttribute('stroke') !== 'none',
    );
    return { motifStrokes: strokes.length, inked: strokes.every((p) => p.style.strokeDashoffset === '0') };
  });
  assert.deepEqual(hero, { motifStrokes: 9, inked: true });
  assert.deepEqual(errors, []);
});

test('the hero, the cards, the closing band and the handshake stage follow the pointer', async (t) => {
  const { page } = await openHome(t);
  await page.mouse.move(1300, 300);
  const px = await page.evaluate(() => document.querySelector('.motif').style.getPropertyValue('--px'));
  assert.ok(+px > 0, `--px is ${px}`);
  const washAt = async (selector, pseudo) => {
    await scrollToSelector(page, selector, 160);
    await page.waitForTimeout(1500);
    const box = await (await page.$(selector)).boundingBox();
    await page.mouse.move(box.x + 40, box.y + 30);
    return page.evaluate(
      ([sel, pse]) => getComputedStyle(document.querySelector(sel), pse).backgroundImage,
      [selector, pseudo],
    );
  };
  // the card lifts on hover, so only its x is fixed; the band and the stage stay put
  assert.match(await washAt('#way-programs', '::after'), /radial-gradient\(360px (circle )?at 40px /);
  assert.match(await washAt('.globe-stage', '::before'), /radial-gradient\(380px (circle )?at 40px 30px/);
  assert.match(await washAt('#contact', '::after'), /radial-gradient\(560px (circle )?at 40px 30px/);
});
