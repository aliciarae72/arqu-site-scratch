const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hoverOver, openPage, scrollToSelector, settle } = require('./page-harness');

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
  const hovered = async () => {
    await hoverOver(page, '#way-market');
    return fill();
  };
  assert.equal(await settle(hovered, (f) => f === 'rgb(94, 84, 200)'), 'rgb(94, 84, 200)');
});

test('hovering Programs moves the book toward the program', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '.way-grid', 160);
  const shift = () =>
    page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.ca-book rect')).transform).e);
  assert.equal(await shift(), 0);
  const hovered = async () => {
    await hoverOver(page, '#way-programs');
    return shift();
  };
  assert.ok((await settle(hovered, (x) => x > 9)) > 9);
});

test('the "or" sits in a clean drawn circle, with no sketched mark over it', async (t) => {
  const { page } = await openPage(t);
  await scrollToSelector(page, '.way-grid', 160);
  // the page's one mark inks on first, so a mark over the "or" would have landed by now too
  await scrollToSelector(page, '#contact', 0);
  await page.waitForSelector('.close > div > .hand-mark > g');
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

test('the landing hero fills the first screen with the headline alone, no graphic', async (t) => {
  const { page } = await openPage(t);
  const hero = await page.evaluate(() => {
    const intro = document.querySelector('#intro');
    const cards = document.querySelector('#ways').getBoundingClientRect();
    return {
      headline: document.querySelector('#hero-title').textContent,
      graphics: intro.querySelectorAll('svg, img, canvas').length,
      alignedWithLogo:
        Math.abs(
          document.querySelector('#hero-title').getBoundingClientRect().left -
            document.querySelector('.top .mark').getBoundingClientRect().left,
        ) < 2,
      cardsBelowFold: cards.top >= window.innerHeight - 40,
    };
  });
  assert.deepEqual(hero, {
    headline: 'Innovate beyond the ask.',
    graphics: 0,
    alignedWithLogo: true,
    cardsBelowFold: true,
  });
});

test('on a phone the "or" sits centred between the stacked cards', async (t) => {
  const { page } = await openPage(t, { width: 390 });
  const off = await page.evaluate(() => {
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    };
    return Math.abs(centre(document.querySelector('.way-grid .or')) - centre(document.querySelector('.way-grid')));
  });
  assert.ok(off < 1, `the "or" sits ${off}px off the middle`);
});
