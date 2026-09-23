const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector, settle } = require('./test/page-harness');

const MARKS = [
  { sel: '.way-grid .or', text: 'or', kind: 'circle' },
  { sel: '#close-title + p', text: 'A broker', kind: 'underline' },
];

// Every mark checked against where its words are right now. Returns one line per mark that is off.
function misplaced(page, label) {
  return page.evaluate(
    ([marks, where]) =>
      marks.flatMap(({ sel, text, kind }) => {
        const el = document.querySelector(sel);
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n = walk.nextNode();
        while (n && !n.nodeValue.includes(text)) n = walk.nextNode();
        const range = document.createRange();
        range.setStart(n, n.nodeValue.indexOf(text));
        range.setEnd(n, n.nodeValue.indexOf(text) + text.length);
        const words = [...range.getClientRects()].filter((r) => r.width > 1);
        const strokes = [...el.parentElement.querySelectorAll(':scope > .hand-mark > g')].map((g) =>
          g.getBoundingClientRect(),
        );
        const expected = kind === 'circle' ? Math.min(1, words.length) : words.length;
        if (strokes.length !== expected)
          return [`${where} ${text}: ${strokes.length} strokes for ${words.length} lines`];
        return strokes.flatMap((s, i) => {
          const w = words[i];
          const on =
            kind === 'circle'
              ? s.left < w.left && s.right > w.right && s.top < w.top && s.bottom > w.bottom
              : Math.abs(s.left - w.left) < 12 &&
                Math.abs(s.right - w.right) < 14 &&
                s.top > w.bottom - 3 &&
                s.bottom < w.bottom + 10;
          return on ? [] : [`${where} ${text}: stroke ${JSON.stringify(s)} vs words ${JSON.stringify(w)}`];
        });
      }),
    [MARKS, label],
  );
}

async function afterReflow(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
}

test('marks further down only draw once scrolled into view', async (t) => {
  const { page, errors } = await openPage(t);
  await page.waitForTimeout(2000);
  const count = () => page.evaluate(() => document.querySelectorAll('.hand-mark > g').length);
  const before = await count();
  await scrollToSelector(page, '#contact', 0);
  assert.equal(await settle(count, (n) => n === before + 1), before + 1);
  assert.deepEqual(errors, []);
});

test('an underline is one fluid stroke: a single path, drawn in a single pass', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '#contact', 0);
  await page.waitForFunction(() => document.querySelector('.close > div > .hand-mark > g'), null, {
    timeout: 6000,
  });
  const paths = await page.evaluate(() =>
    [...document.querySelectorAll('.close > div > .hand-mark path')].map((p) => p.getAttribute('d')),
  );
  assert.equal(paths.length, 1);
  assert.equal(paths[0].match(/M/g).length, 1, paths[0]);
});

test('every mark lands on its words at 1440, 1024 and 390, and stays there as the page reflows', async (t) => {
  const { page, errors } = await openPage(t);
  for (const m of MARKS) {
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), m.sel);
    await page.waitForFunction(
      (sel) => document.querySelector(sel).parentElement.querySelector('.hand-mark > g'),
      m.sel,
      {
        timeout: 6000,
      },
    );
  }
  assert.deepEqual(await misplaced(page, '1440'), []);
  await page.setViewportSize({ width: 1024, height: 900 });
  await afterReflow(page);
  assert.deepEqual(await misplaced(page, '1024'), []);
  await page.setViewportSize({ width: 390, height: 844 });
  await afterReflow(page);
  assert.deepEqual(await misplaced(page, '390'), []);
  assert.deepEqual(errors, []);
});
