const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector } = require('./test/page-harness');

async function drawn(t) {
  const opened = await openPage(t);
  await scrollToSelector(opened.page, '#human', 60);
  await opened.page.waitForFunction(
    () => {
      const svg = document.getElementById('hs');
      return svg.classList.contains('drawn') && svg.classList.contains('orbiting');
    },
    null,
    { timeout: 15000 },
  );
  return opened;
}

test('the handshake draws itself on, then the ring and labels arrive', async (t) => {
  const { page, errors } = await drawn(t);
  const state = await page.evaluate(() => {
    const svg = document.getElementById('hs');
    const figures = [...svg.querySelectorAll('path.fig')];
    return {
      figures: figures.length,
      masked: figures.filter((p) => p.hasAttribute('mask')).length,
      drawn: svg.classList.contains('drawn'),
      orbiting: svg.classList.contains('orbiting'),
      labels: [...svg.querySelectorAll('text.lbl')].map((n) => n.textContent),
      // one shaft and one head for each label's arrow
      arrowStrokes: svg.lastElementChild.querySelectorAll('path').length,
    };
  });
  assert.deepEqual(state, {
    figures: 12,
    masked: 0,
    drawn: true,
    orbiting: true,
    labels: ['you', 'your broker'],
    arrowStrokes: 4,
  });
  assert.deepEqual(errors, []);
});

test('the dots keep circling while the section is in view', async (t) => {
  const { page } = await drawn(t);
  const where = () => page.evaluate(() => [...document.querySelectorAll('#hs .odot')].map((d) => d.getAttribute('cx')));
  const first = await where();
  await page.waitForFunction(
    (prev) => [...document.querySelectorAll('#hs .odot')].some((d, i) => d.getAttribute('cx') !== prev[i]),
    first,
    { timeout: 5000 },
  );
  assert.notDeepEqual(await where(), first);
});

test('hovering makes the two forearms shake together about their shoulders', async (t) => {
  const { page } = await drawn(t);
  // the automatic post-draw shake must finish first, so the sampled shear comes from the hover
  await page.waitForFunction(
    () =>
      [5, 11].every((i) =>
        /^matrix\(1 0 0 1 0 0\)$/.test(document.getElementById('hs-p' + i).getAttribute('transform') || ''),
      ),
    null,
    { timeout: 6000 },
  );
  const box = await (await page.$('#hs')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The shake is a sine, so a single sample can land on a zero crossing or before the
  // first frame on a loaded machine; wait for a frame where both arms are sheared.
  const arms = await page
    .waitForFunction(
      () => {
        // a near-zero shear serialises in exponent form, so read whole numbers, exponent included
        const shear = (i) =>
          (document.getElementById('hs-p' + i).getAttribute('transform') || '')
            .match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
            ?.map(Number) ?? [];
        const pair = [shear(5), shear(11)];
        return pair.every((m) => m.length === 6 && Math.abs(m[1]) > 1e-3) ? pair : null;
      },
      null,
      { timeout: 6000 },
    )
    .then((h) => h.jsonValue());
  // matrix(1 k 0 1 0 f): a shear k with the shoulder held fixed; opposite signs keep the hands joined
  assert.ok(arms[0][1] !== 0 && Math.sign(arms[0][1]) === -Math.sign(arms[1][1]), `shears ${arms[0][1]} ${arms[1][1]}`);
});

test('under reduced motion the orbit dots are visible, not stuck at opacity 0', async (t) => {
  const { page } = await openPage(t);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await scrollToSelector(page, '#human', 60);
  const opacities = await page
    .waitForFunction(
      () => {
        const dots = [...document.querySelectorAll('#hs .odot')];
        return dots.length && dots.every((d) => Number(d.style.opacity) > 0) ? dots.map((d) => d.style.opacity) : null;
      },
      null,
      { timeout: 6000 },
    )
    .then((h) => h.jsonValue());
  assert.ok(opacities.length > 0);
});
