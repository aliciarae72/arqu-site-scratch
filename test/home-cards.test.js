const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector, settle } = require('./page-harness');

async function hover(page, selector) {
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
}

test('each landing card carries a drawing of what it offers: one risk to the market, a book into a program', async (t) => {
  const { page, errors } = await openPage(t);
  const arts = await page.evaluate(() =>
    [...document.querySelectorAll('a.way svg.card-art')].map((svg) => ({
      card: svg.closest('a').id,
      art: svg.dataset.art,
      markets: svg.querySelectorAll('.ca-markets rect').length,
      book: svg.querySelectorAll('.ca-book rect').length,
      labels: [...svg.querySelectorAll('text')].map((n) => n.textContent),
    })),
  );
  assert.deepEqual(arts, [
    { card: 'way-market', art: 'market', markets: 4, book: 0, labels: ['One risk', 'The right market'] },
    { card: 'way-programs', art: 'programs', markets: 0, book: 12, labels: ['Your book', 'One program'] },
  ]);
  assert.equal(await page.evaluate(() => document.querySelectorAll('canvas[data-art]').length), 0);
  assert.deepEqual(errors, []);
});

test('hovering Open market lights the one market that fits the risk', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '.way-grid', 160);
  const fill = () => page.evaluate(() => getComputedStyle(document.querySelector('rect.ca-hit')).fill);
  assert.notEqual(await fill(), 'rgb(94, 84, 200)');
  await hover(page, '#way-market');
  assert.equal(await settle(fill, (f) => f === 'rgb(94, 84, 200)'), 'rgb(94, 84, 200)');
});

test('hovering Programs moves the book toward the program', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '.way-grid', 160);
  const shift = () =>
    page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.ca-book rect')).transform).e);
  assert.equal(await shift(), 0);
  await hover(page, '#way-programs');
  assert.ok((await settle(shift, (x) => x > 9)) > 9);
});

test('the "or" sits in a clean drawn circle, with no sketched mark over it', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '.way-grid', 160);
  await page.waitForTimeout(1500);
  const or = await page.evaluate(() => {
    const el = document.querySelector('.way-grid .or');
    const cs = getComputedStyle(el);
    return {
      radius: cs.borderRadius,
      border: cs.borderTopStyle,
      marks: el.parentElement.querySelectorAll('.hand-mark').length,
    };
  });
  assert.deepEqual(or, { radius: '50%', border: 'solid', marks: 0 });
});

test('each card description runs the full width of its card', async (t) => {
  const { page } = await openPage(t);
  const gaps = await page.evaluate(() =>
    [...document.querySelectorAll('.way-desc')].map(
      (d) => d.parentElement.getBoundingClientRect().width - d.getBoundingClientRect().width,
    ),
  );
  assert.deepEqual(gaps, [0, 0]);
});

test('the landing hero fills the first screen, the words beside the handshake', async (t) => {
  const { page } = await openPage(t);
  const hero = await page.evaluate(() => {
    const words = document.querySelector('.splash-copy').getBoundingClientRect();
    const stage = document.querySelector('.globe-stage').getBoundingClientRect();
    const cards = document.querySelector('#ways').getBoundingClientRect();
    return { beside: words.right <= stage.left, cardsBelowFold: cards.top >= window.innerHeight - 40 };
  });
  assert.deepEqual(hero, { beside: true, cardsBelowFold: true });
});
