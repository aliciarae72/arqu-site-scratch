const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector, settle } = require('./test/page-harness');

test('the cards, the closing band and the handshake stage follow the pointer', async (t) => {
  const { page } = await openHome(t);
  // x = 240 keeps the pointer clear of the fixed spine rail on the left edge, whose dots take the hover
  // The element may still be revealing or scrolling into place, so re-aim the pointer at it on every read.
  const washAt = async (selector, pseudo, expected) => {
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
  // the card lifts on hover, so only its x is fixed; the band and the stage stay put
  const card = /radial-gradient\(360px (circle )?at 240px /;
  const stage = /radial-gradient\(380px (circle )?at 240px 30px/;
  const band = /radial-gradient\(560px (circle )?at 240px 30px/;
  assert.match(await washAt('#way-programs', '::after', card), card);
  assert.match(await washAt('.globe-stage', '::before', stage), stage);
  assert.match(await washAt('#contact', '::after', band), band);
});
