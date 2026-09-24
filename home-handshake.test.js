const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPage, scrollToSelector } = require('./test/page-harness');

async function drawn(t) {
  const opened = await openPage(t, { url: 'about.html' });
  await scrollToSelector(opened.page, '#hs', 120);
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

test('hovering makes the two figures high-five: both arms swing up about their shoulders', async (t) => {
  const { page } = await drawn(t);
  // the automatic post-draw shake must finish first, so the sampled pose comes from the hover
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
  // wait for the frame where both arms are raised high, then read where the two hands are
  const pose = await page
    .waitForFunction(
      () => {
        const angle = (i) => {
          const m = (document.getElementById('hs-p' + i).getAttribute('transform') || '').match(
            /^rotate\((-?[\d.e+-]+) /,
          );
          return m ? Number(m[1]) : 0;
        };
        const [left, right] = [angle(5), angle(11)];
        if (Math.abs(left) < 60 || Math.abs(right) < 60) return null;
        const hand = (i) => document.getElementById('hs-p' + i).getBoundingClientRect();
        const heads = [0, 6].map((i) => document.getElementById('hs-p' + i).getBoundingClientRect());
        return {
          left,
          right,
          handsTop: Math.min(hand(5).top, hand(11).top),
          headsBottom: Math.max(...heads.map((h) => h.bottom)),
        };
      },
      null,
      { timeout: 6000 },
    )
    .then((h) => h.jsonValue());
  // left arm turns up (negative), right arm turns up the other way (positive)
  assert.ok(pose.left < 0 && pose.right > 0, `angles ${pose.left} ${pose.right}`);
  assert.ok(
    pose.handsTop < pose.headsBottom,
    `raised hands top ${pose.handsTop} sits below the heads ${pose.headsBottom}`,
  );
});

test('under reduced motion the orbit dots are visible, not stuck at opacity 0', async (t) => {
  const { page } = await openPage(t, { url: 'about.html' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await scrollToSelector(page, '#hs', 120);
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

test('a hover that lands during the opening shake still gets its high-five once the shake ends', async (t) => {
  const { page } = await openPage(t, { url: 'about.html' });
  await scrollToSelector(page, '#hs', 120);
  // the opening shake shears the forearms; catch it mid-move
  await page.waitForFunction(
    () => /^matrix\(1 -?[\d.e-]*[1-9]/.test(document.getElementById('hs-p5').getAttribute('transform') || ''),
    null,
    { timeout: 15000, polling: 16 },
  );
  const box = await (await page.$('#hs')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const raised = await page
    .waitForFunction(
      () => {
        const m = (document.getElementById('hs-p5').getAttribute('transform') || '').match(/^rotate\((-?[\d.e+-]+) /);
        return m && Number(m[1]) < -60 ? Number(m[1]) : null;
      },
      null,
      { timeout: 6000 },
    )
    .then((h) => h.jsonValue());
  assert.ok(raised < -60, `the left arm only reached ${raised}`);
});
