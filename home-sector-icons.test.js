const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openHome, scrollToSelector, settle } = require('./test/page-harness');

// every icon's strokes, whether they have finished inking on, and where the icon sits against its heading
function columns(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('#flow-market .node')].map((node) => {
      const icon = node.querySelector('.sector-icon');
      const paths = [...icon.querySelectorAll('path')];
      return {
        icon: icon.getAttribute('data-icon'),
        strokes: paths.length,
        purple: paths.filter((p) => p.getAttribute('stroke') === '#5e54c8').length,
        inked: paths.every((p) => getComputedStyle(p).strokeDashoffset === '0px'),
        aboveHeading: icon.getBoundingClientRect().bottom <= node.querySelector('h3').getBoundingClientRect().top,
        dotAndRule: getComputedStyle(node, '::before').content !== 'none',
      };
    }),
  );
}

test('opening Open market heads each column with a hand-drawn icon instead of the purple dots', async (t) => {
  const { page, errors } = await openHome(t);
  await page.click('#way-market');
  await scrollToSelector(page, '#flow-market .branches', 140);
  const icon = { purple: 1, inked: true, aboveHeading: true, dotAndRule: false };
  const allInked = (cols) => cols.every((c) => c.inked);
  assert.deepEqual(await settle(() => columns(page), allInked), [
    { ...icon, icon: 'construction', strokes: 9 },
    { ...icon, icon: 'realEstate', strokes: 12 },
    { ...icon, icon: 'energy', strokes: 11 },
  ]);
  assert.deepEqual(errors, []);
});

test('closing and reopening the flow inks the icons on again', async (t) => {
  const { page } = await openHome(t, { query: '?open=market' });
  await scrollToSelector(page, '.way-grid', 120);
  assert.ok((await settle(() => columns(page), (cols) => cols.every((c) => c.inked))).every((c) => c.inked));
  await page.click('#way-market');
  await page.click('#way-market');
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.sector-icon path')].some((p) => getComputedStyle(p).strokeDashoffset !== '0px'),
    null,
    { timeout: 3000 },
  );
  assert.ok((await settle(() => columns(page), (cols) => cols.every((c) => c.inked))).every((c) => c.inked));
});
