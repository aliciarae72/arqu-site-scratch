// The Programs chart in a real Chrome: a still scatter with axes, labels and the whole-book line.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage } = require('./page-harness');

const readChart = (page) =>
  page.evaluate(() => {
    const fig = document.querySelector('[data-book-chart]');
    const texts = (sel) => [...fig.querySelectorAll(sel)].map((t) => t.textContent);
    const style = getComputedStyle(fig);
    return {
      dots: fig.querySelectorAll('.bz-plot circle').length,
      view: fig.querySelector('.bz-plot').getAttribute('viewBox'),
      ticks: texts('.bz-label'),
      titles: texts('.bz-title'),
      focus: texts('.bz-focus-label'),
      avg: texts('.bz-avg-label'),
      total: fig.querySelector('.bz-total').textContent,
      card: style.borderTopStyle !== 'none' || style.boxShadow !== 'none',
      replay: fig.querySelectorAll('button').length,
    };
  });

test('programs.html: the hero is a still scatter with axes, tick labels and the whole-book line', async (t) => {
  const { page, errors } = await openPage(t, { url: 'programs.html' });
  await page.locator('[data-book-chart]').scrollIntoViewIfNeeded();
  const first = await readChart(page);
  assert.deepEqual(
    { ...first, view: typeof first.view },
    {
      dots: 240,
      view: 'string',
      ticks: ['0%', '25%', '50%', '75%', '100%', '$50k', '$100k', '$200k', '$500k', '$1M'],
      titles: ['Premium →', '↑ Loss ratio'],
      focus: ['One account · 87%'],
      avg: ['Whole book 22%'],
      total: 'Whole book 22% · 240 accounts',
      card: false,
      replay: 0,
    },
  );
  await page.waitForTimeout(1500);
  assert.equal((await readChart(page)).view, first.view, 'the chart moved: it should hold still');
  assert.deepEqual(errors, []);
});

test('programs.html: the focus label sits left of its dot, inside the chart', async (t) => {
  const { page } = await openPage(t, { url: 'programs.html', width: 390, height: 844 });
  const placed = await page.evaluate(() => {
    const svg = document.querySelector('[data-bz-svg]').getBoundingClientRect();
    const label = document.querySelector('.bz-focus-label').getBoundingClientRect();
    const dot = document.querySelector('.bz-focus').getBoundingClientRect();
    return { leftOfDot: label.right <= dot.left, inside: label.left >= svg.left - 1 };
  });
  assert.deepEqual(placed, { leftOfDot: true, inside: true });
});
