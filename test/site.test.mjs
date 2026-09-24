// Static checks for the pages GitHub Pages serves from this repo. There is no
// build step, so a syntax error in an inline <script> or a missing sibling file
// only shows up as a broken page in someone's browser. These catch both first.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { scriptTags } from './script-tags.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('.'));

function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

function assertLocalFilesExist(page, refs) {
  refs
    .filter((ref) => !/^https?:/.test(ref))
    .forEach((ref) => {
      assert.ok(existsSync(join(ROOT, ref)), `${page} loads missing ${ref}`);
    });
}

test('serves the landing page and both ways in', () => {
  for (const page of ['home.html', 'open-market.html', 'programs.html']) assert.ok(PAGES.includes(page), page);
});

const CORE_CSS = ['home.css', 'home-layers.css', 'home-spine.css', 'home-hand.css'];
const LOAD_ORDER = {
  'home.html': {
    css: [...CORE_CSS, 'home-motif.css'],
    js: [
      'home-interaction.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-ambient.js',
      'arqu-edit-layer.js',
    ],
  },
  'open-market.html': {
    css: [...CORE_CSS, 'home-pages.css', 'home-risk-narrative.css', 'home-lines.css'],
    js: [
      'home-interaction.js',
      'home-risk-narrative.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-sector-icons.js',
      'home-ambient.js',
      'home-lines.js',
      'hail-grid.js',
      'home-hail-map.js',
      'home-hail-map-ui.js',
      'arqu-edit-layer.js',
    ],
  },
  'programs.html': {
    css: [...CORE_CSS, 'home-pages.css', 'home-book-zoom.css'],
    js: [
      'home-interaction.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-ambient.js',
      'home-book-zoom.js',
      'arqu-edit-layer.js',
    ],
  },
  'about.html': {
    css: [...CORE_CSS, 'home-pages.css'],
    js: [
      'home-interaction.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-handshake.js',
      'home-ambient.js',
      'arqu-edit-layer.js',
    ],
  },
  'construction.html': {
    css: [...CORE_CSS, 'home-pages.css'],
    js: [
      'home-interaction.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-sector-icons.js',
      'home-ambient.js',
      'arqu-edit-layer.js',
    ],
  },
  'energy.html': {
    css: [...CORE_CSS, 'home-pages.css'],
    js: [
      'home-interaction.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-sector-icons.js',
      'home-ambient.js',
      'arqu-edit-layer.js',
    ],
  },
};
const read = (page) => readFileSync(join(ROOT, page), 'utf8');

for (const [page, want] of Object.entries(LOAD_ORDER)) {
  test(`${page} links its split stylesheets and scripts, in load order`, () => {
    const html = read(page);
    assert.deepEqual(
      stylesheetHrefs(html).filter((h) => h.startsWith('home')),
      want.css,
    );
    assert.deepEqual(
      scriptTags(html).map((s) => s.src.replace(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(roughjs)@.*$/, '$1')),
      want.js,
    );
  });

  test(`${page} pins its remote scripts with an integrity hash`, () => {
    const remote = scriptTags(read(page)).filter((s) => /^https?:/.test(s.src));
    assert.ok(remote.length > 0);
    remote.forEach((s) => {
      assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `${page} loads ${s.src} unpinned`);
    });
  });
}

test('home.html is the headline hero, then exactly two card links', () => {
  const html = read('home.html');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.deepEqual(
    [...main.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]),
    ['intro', 'ways', 'contact'],
  );
  ['Innovate beyond <em>the ask.</em>', 'We are wholesale brokers and technologists.'].forEach((part) => {
    assert.ok(main.includes(part), `the landing hero is missing ${part}`);
  });
  assert.ok(!main.includes('The tools turn.'), 'the landing page still carries the line Alicia cut');
  assert.ok(!main.includes('id="hs"'), 'the landing hero still carries a graphic');
  assert.deepEqual(
    [...main.matchAll(/<a class="way" id="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]),
    [
      ['way-market', 'open-market.html'],
      ['way-programs', 'programs.html'],
    ],
  );
});

// The three pages share one edit-layer store, so saved copy follows its words to whichever page holds them.
test('every page configures the edit layer the same way', () => {
  const config = (page) =>
    read(page)
      .match(/<script id="arqu-edit-layer"[^>]*>/)[0]
      .replace(/ data-what="[^"]*"/, '');
  assert.equal(config('open-market.html'), config('home.html'));
  ['programs.html', 'about.html', 'construction.html', 'energy.html'].forEach((page) => {
    assert.equal(config(page), config('home.html'), page);
  });
});

for (const [page, flow] of [
  ['open-market.html', 'flow-market'],
  ['programs.html', 'flow-programs'],
]) {
  test(`${page} carries its flow open, with a way back to the landing page`, () => {
    const html = read(page);
    // the exact tag, so a flow left `hidden` with no toggle to show it fails here
    assert.ok(html.includes(`<div class="flow" id="${flow}">`), `${page} has no open #${flow}`);
    assert.ok(html.includes('<a class="back" href="home.html">'), `${page} has no link back`);
  });
}

for (const page of PAGES) {
  const html = read(page);

  test(`${page}: every inline script parses`, () => {
    inlineScripts(html).forEach((code, i) => {
      assert.doesNotThrow(() => new vm.Script(code, { filename: `${page}#script${i}` }));
    });
  });

  test(`${page}: every local script file exists and parses`, () => {
    const local = scriptTags(html)
      .map((s) => s.src)
      .filter((src) => !/^https?:/.test(src));
    assertLocalFilesExist(page, local);
    local.forEach((src) => {
      assert.doesNotThrow(() => new vm.Script(readFileSync(join(ROOT, src), 'utf8'), { filename: src }));
    });
  });

  test(`${page}: every local stylesheet exists`, () => {
    assertLocalFilesExist(page, stylesheetHrefs(html));
  });
}
