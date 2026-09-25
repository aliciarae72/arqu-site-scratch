// The scroll study's spine and readout in a real Chrome: the section in view is the one named.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('./test/page-harness');

test('scroll.html: the spine marks and the readout names the section in view, both ways', async (t) => {
  const { page, errors } = await openPage(t, { url: 'scroll.html', width: 1280 });
  const read = () =>
    page.evaluate(() => {
      const dots = [...document.querySelectorAll('#dots > *')];
      return {
        readout: document.getElementById('readout').textContent,
        current: dots.findIndex((d) => d.getAttribute('aria-current') === 'true'),
        dots: dots.length,
      };
    });
  // the readout repaints on the next animation frame after a scroll, so re-read until it names the section
  const at = async (id, want) => {
    await page.evaluate((sec) => {
      const top = document.getElementById(sec).getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: 'instant' });
    }, id);
    return settle(read, (now) => now.readout === want.readout);
  };
  for (const want of [
    { id: 's-tower', readout: '03 — Tower', current: 3 },
    { id: 's-aurora', readout: '11 — Ask', current: 11 },
    { id: 's-market', readout: '02 — Market', current: 2 },
  ]) {
    assert.deepEqual(await at(want.id, want), { readout: want.readout, current: want.current, dots: 12 });
  }
  assert.deepEqual(errors, []);
});
