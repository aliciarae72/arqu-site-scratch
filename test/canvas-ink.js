// Reads what a canvas has drawn, for the reference reels whose studies paint to <canvas>.
const { settle } = require('./page-harness');

// How many pixels of a canvas carry paint, and a hash of every pixel, so two frames can be told apart.
function inkOf(page, id) {
  return page.evaluate((canvasId) => {
    const canvas = document.getElementById(canvasId);
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    let hash = 0;
    for (let k = 0; k < data.length; k += 4) {
      if (data[k + 3] > 0) painted++;
      hash = (Math.imul(hash, 31) + data[k] + data[k + 1] * 3 + data[k + 2] * 7 + data[k + 3] * 11) | 0;
    }
    return { painted, hash };
  }, id);
}

// Brings a canvas to the middle of the viewport, where its player runs.
function centre(page, id) {
  return page.evaluate(
    (canvasId) =>
      new Promise((landed) => {
        document.getElementById(canvasId).scrollIntoView({ block: 'center', behavior: 'instant' });
        requestAnimationFrame(() => requestAnimationFrame(() => landed()));
      }),
    id,
  );
}

// Drags a motion-sample panel's scrubber to `value` (0 to 1000) and returns its ink there.
async function inkAtScrub(page, n, value) {
  await page.evaluate(
    ([panel, at]) => {
      const scrub = document.querySelector(`[data-scrub="${panel}"]`);
      scrub.value = String(at);
      scrub.dispatchEvent(new Event('input'));
    },
    [n, value],
  );
  return inkOf(page, `c${n}`);
}

// Each study in panels `numbers` draws, and draws a different frame halfway through its scrub.
async function studiesDraw(page, numbers) {
  const seen = {};
  for (const n of numbers) {
    await centre(page, `c${n}`);
    const start = await inkAtScrub(page, n, 0);
    const middle = await inkAtScrub(page, n, 500);
    await inkAtScrub(page, n, 1000);
    const tv = await page.textContent(`[data-tv="${n}"]`);
    seen[n] = { drawn: Math.max(start.painted, middle.painted) > 0, moves: start.hash !== middle.hash, tv };
  }
  return seen;
}

// Scrolls so section `sectionId` is `progress` of the way through its pass across the
// viewport (0 as its top enters at the bottom, 1 as its bottom leaves at the top).
function scrollToProgress(page, sectionId, progress) {
  return page.evaluate(
    ([id, p]) =>
      new Promise((landed) => {
        const sec = document.getElementById(id);
        const vh = window.innerHeight;
        const box = sec.getBoundingClientRect();
        const top = box.top + window.scrollY;
        window.scrollTo({ top: top - (vh - p * (vh + box.height)), behavior: 'instant' });
        requestAnimationFrame(() => requestAnimationFrame(() => landed()));
      }),
    [sectionId, progress],
  );
}

// Each scroll-study canvas in `ids` paints, and paints a new frame further through its section.
async function scrollDraws(page, ids) {
  const seen = {};
  for (const id of ids) {
    const section = id.replace(/^c-/, 's-');
    await scrollToProgress(page, section, 0.3);
    const early = await settle(
      () => inkOf(page, id),
      (ink) => ink.painted > 0,
      3000,
    );
    await scrollToProgress(page, section, 0.55);
    // the page repaints on its own animation frame after the scroll lands
    const later = await settle(
      () => inkOf(page, id),
      (ink) => ink.hash !== early.hash,
      3000,
    );
    seen[id] = { drawn: later.painted > 0, moves: early.hash !== later.hash };
  }
  return seen;
}

module.exports = { centre, inkOf, scrollDraws, studiesDraw };
