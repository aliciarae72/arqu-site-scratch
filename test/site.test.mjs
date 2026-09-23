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

test('serves at least the home page', () => {
  assert.ok(PAGES.includes('home.html'));
});

test('home.html links its split stylesheets and scripts, in load order', () => {
  const html = readFileSync(join(ROOT, 'home.html'), 'utf8');
  assert.deepEqual(stylesheetHrefs(html).filter((h) => h.startsWith('home')), [
    'home.css',
    'home-layers.css',
    'home-spine.css',
    'home-hand.css',
    'home-risk-narrative.css',
    'home-lines.css',
  ]);
  assert.deepEqual(
    scriptTags(html).map((s) => s.src.replace(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(roughjs)@.*$/, '$1')),
    [
      'home-flows.js',
      'home-interaction.js',
      'home-risk-narrative.js',
      'home-card-art.js',
      'roughjs',
      'home-hand.js',
      'home-hand-marks.js',
      'home-sector-icons.js',
      'home-handshake.js',
      'home-ambient.js',
      'home-lines.js',
      'hail-grid.js',
      'home-hail-map.js',
      'home-hail-map-ui.js',
      'arqu-edit-layer.js',
    ],
  );
});

for (const page of PAGES) {
  const html = readFileSync(join(ROOT, page), 'utf8');

  test(`${page}: every inline script parses`, () => {
    inlineScripts(html).forEach((code, i) => {
      assert.doesNotThrow(() => new vm.Script(code, { filename: `${page}#script${i}` }));
    });
  });

  test(`${page}: every local script file exists and parses`, () => {
    const local = scriptTags(html).map((s) => s.src).filter((src) => !/^https?:/.test(src));
    assertLocalFilesExist(page, local);
    local.forEach((src) => {
      assert.doesNotThrow(() => new vm.Script(readFileSync(join(ROOT, src), 'utf8'), { filename: src }));
    });
  });

  test(`${page}: every local stylesheet exists`, () => {
    assertLocalFilesExist(page, stylesheetHrefs(html));
  });
}

const HOME = readFileSync(join(ROOT, 'home.html'), 'utf8');

test('home.html pins its remote scripts with an integrity hash', () => {
  const remote = scriptTags(HOME).filter((s) => /^https?:/.test(s.src));
  assert.ok(remote.length > 0);
  remote.forEach((s) => {
    assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `home.html loads ${s.src} unpinned`);
  });
});
