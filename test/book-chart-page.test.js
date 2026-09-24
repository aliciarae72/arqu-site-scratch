// The Programs chart in a real Chrome: a still scatter with axes, labels and the whole-book line.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('./page-harness');

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

const FULL_TICKS = ['0%', '25%', '50%', '75%', '100%', '$50k', '$100k', '$200k', '$500k', '$1M'];
// the pull-back has ended once the axes read the whole chart
const pulledBack = (ticks) => ticks.join() === FULL_TICKS.join();

test('programs.html: the scatter opens close on the 87% account, pulls back to the whole chart, then holds still', async (t) => {
  const { page, errors } = await openPage(t, { url: 'programs.html' });
  const first = await readChart(page);
  assert.ok(first.ticks.includes('$1M') && !first.ticks.includes('$50k'), `the close-up axes read ${first.ticks}`);
  assert.deepEqual([first.focus, first.avg], [[], []], 'the close-up shows labels meant for the whole chart');
  const width = (view) => Number(view.split(' ')[2]);
  const end = await settle(
    () => readChart(page),
    (now) => pulledBack(now.ticks),
  );
  assert.ok(width(end.view) > width(first.view) * 3, 'the camera did not pull back');
  assert.deepEqual(
    { ...end, view: typeof end.view },
    {
      dots: 240,
      view: 'string',
      ticks: FULL_TICKS,
      titles: ['Premium →', '↑ Loss ratio'],
      focus: ['One account · 87%'],
      avg: ['Whole book 22%'],
      total: 'Whole book 22% · 240 accounts',
      card: false,
      replay: 0,
    },
  );
  await page.waitForTimeout(1000);
  const rested = (await readChart(page)).view;
  await page.waitForTimeout(1000);
  assert.equal((await readChart(page)).view, rested, 'the chart still moves after the pull-back');
  assert.deepEqual(errors, []);
});

test('programs.html: the focus label sits left of its dot, inside the chart', async (t) => {
  const { page } = await openPage(t, { url: 'programs.html', width: 390, height: 844 });
  await page.locator('[data-book-chart]').scrollIntoViewIfNeeded();
  await settle(
    () => readChart(page),
    (now) => pulledBack(now.ticks),
  );
  const placed = await page.evaluate(() => {
    const svg = document.querySelector('[data-bz-svg]').getBoundingClientRect();
    const label = document.querySelector('.bz-focus-label').getBoundingClientRect();
    const dot = document.querySelector('.bz-focus').getBoundingClientRect();
    return { leftOfDot: label.right <= dot.left, inside: label.left >= svg.left - 1 };
  });
  assert.deepEqual(placed, { leftOfDot: true, inside: true });
});
