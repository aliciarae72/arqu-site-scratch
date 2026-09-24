// The Programs hero in a real Chrome: the pull-back from one loss to the whole book.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('./page-harness');

const readFigure = (page) =>
  page.evaluate(() => {
    const fig = document.querySelector('[data-book-zoom]');
    return {
      phase: fig.getAttribute('data-phase'),
      ratio: fig.querySelector('[data-bz-ratio]').textContent,
      who: fig.querySelector('[data-bz-who]').textContent,
      dots: fig.querySelectorAll('circle').length,
      width: fig.querySelector('[data-bz-svg]').viewBox.baseVal.width,
    };
  });

test('programs.html: the hero opens on one 87% loss and pulls back to the whole book at 27%', async (t) => {
  const { page, errors } = await openPage(t, { url: 'programs.html' });
  const first = await readFigure(page);
  assert.equal(first.dots, 240);
  const seen = new Set([first.phase]);
  const end = await settle(
    async () => {
      const now = await readFigure(page);
      seen.add(now.phase);
      return now;
    },
    (now) => now.phase === 'book',
  );
  assert.deepEqual(end, { phase: 'book', ratio: '27%', who: 'Whole book · 240 accounts', dots: 240, width: end.width });
  assert.ok(end.width > first.width * 3, 'the camera did not pull back');
  assert.ok(seen.has('zoom'), 'it jumped to the end without zooming');

  await page.click('[data-bz-replay]');
  const replayed = await settle(
    () => readFigure(page),
    (now) => now.phase === 'one',
    3000,
  );
  assert.deepEqual([replayed.ratio, replayed.who], ['87%', 'One account']);
  assert.deepEqual(errors, []);
});

test('programs.html: the note and the ratio sit under the drawing, never over it', async (t) => {
  const { page } = await openPage(t, { url: 'programs.html' });
  const overlaps = await page.evaluate(() => {
    const stage = document.querySelector('[data-bz-stage]').getBoundingClientRect();
    return ['.bz-note', '.bz-read'].filter(
      (sel) => document.querySelector(sel).getBoundingClientRect().top < stage.bottom,
    );
  });
  assert.deepEqual(overlaps, []);
});
