const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector, settle } = require('./test/page-harness');

// x = 240 keeps the pointer clear of the fixed spine rail on the left edge, whose dots take the hover.
// The element may still be revealing or scrolling into place, so the pointer is re-aimed on every read.
function washOn(page) {
  return async (selector, pseudo, expected) => {
    await scrollToSelector(page, selector, 160);
    return settle(
      async () => {
        const box = await (await page.$(selector)).boundingBox();
        await page.mouse.move(box.x + 240, box.y + 30);
        return page.evaluate(
          ([sel, pse]) => getComputedStyle(document.querySelector(sel), pse).backgroundImage,
          [selector, pseudo],
        );
      },
      (bg) => expected.test(bg),
    );
  };
}

test('the landing cards and the closing band follow the pointer', async (t) => {
  const { page } = await openPage(t);
  const washAt = washOn(page);
  // the card lifts on hover, so only its x is fixed; the band stays put
  const card = /radial-gradient\(360px (circle )?at 240px /;
  const band = /radial-gradient\(560px (circle )?at 240px 30px/;
  assert.match(await washAt('#way-programs', '::after', card), card);
  assert.match(await washAt('#contact', '::after', band), band);
});

test('the handshake stage on About follows the pointer', async (t) => {
  const { page } = await openPage(t, { url: 'about.html' });
  const stage = /radial-gradient\(380px (circle )?at 240px 30px/;
  assert.match(await washOn(page)('.globe-stage', '::before', stage), stage);
});
