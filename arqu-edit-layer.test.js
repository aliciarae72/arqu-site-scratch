const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./test/page-harness');

const PAGES = ['home.html', 'open-market.html', 'programs.html'];

// The parsed tree, not the source text: an unclosed <section> reads fine to a regex
// and still nests every later section inside it.
test('every section on every page is a direct child of main', async (t) => {
  const { page } = await openPage(t);
  const origin = new URL(page.url()).origin;
  const nested = {};
  for (const url of PAGES) {
    await page.goto(`${origin}/${url}`);
    nested[url] = await page.evaluate(() =>
      [...document.querySelectorAll('main section')].filter((s) => s.parentElement.tagName !== 'MAIN').map((s) => s.id),
    );
  }
  assert.deepEqual(nested, { 'home.html': [], 'open-market.html': [], 'programs.html': [] });
});

// A browser that never loaded the content-keyed store still holds the index store typed
// on the one-page homepage. No split page has that node order, so none may apply it.
test('a split page applies no copy from the legacy index store, and leaves that store as it was', async (t) => {
  const { page } = await openPage(t);
  const origin = new URL(page.url()).origin;
  const legacy = JSON.stringify({ 0: 'LEGACY COPY', 5: 'LEGACY COPY', 20: 'LEGACY COPY' });
  const result = {};
  for (const url of PAGES) {
    await page.evaluate((v1) => {
      localStorage.clear();
      localStorage.setItem('arqu-copy-home-v3', v1);
    }, legacy);
    await page.goto(`${origin}/${url}`);
    await page.waitForSelector('#edbar');
    result[url] = await page.evaluate(() => ({
      pasted: document.body.innerHTML.includes('LEGACY COPY'),
      v1: localStorage.getItem('arqu-copy-home-v3'),
      count: document.getElementById('edcount').textContent,
    }));
  }
  const clean = { pasted: false, v1: legacy, count: 'no edits' };
  assert.deepEqual(result, { 'home.html': clean, 'open-market.html': clean, 'programs.html': clean });
});
