// Static checks for the pages GitHub Pages serves from this repo. There is no
// build step, so a syntax error in an inline <script> or a missing sibling file
// only shows up as a broken page in someone's browser. These catch both first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('.'));

function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function scriptTags(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({ tag: m[0], src: m[1] }));
}

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

test('serves at least the home page', () => {
  assert.ok(PAGES.includes('home.html'));
});

test('home.html links its split stylesheets and scripts, in load order', () => {
  const html = readFileSync(join(ROOT, 'home.html'), 'utf8');
  assert.deepEqual(
    stylesheetHrefs(html).filter((h) => h.startsWith('home')),
    ['home.css', 'home-layers.css'],
  );
  assert.deepEqual(
    scriptTags(html).map((s) => s.src.replace(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(roughjs)@.*$/, '$1')),
    [
      'home-flows.js',
      'home-interaction.js',
      'home-risk-narrative-visuals.js',
      'home-risk-narrative.js',
      'home-card-art.js',
      'roughjs',
      'home-hand.js',
      'home-handshake.js',
      'home-ambient.js',
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

  test(`${page}: every local stylesheet exists`, () => {
    stylesheetHrefs(html)
      .filter((href) => !/^https?:/.test(href))
      .forEach((href) => assert.ok(existsSync(join(ROOT, href)), `${page} links missing ${href}`));
  });

  test(`${page}: every local script file exists and parses`, () => {
    scriptTags(html)
      .filter((s) => !/^https?:/.test(s.src))
      .forEach((s) => {
        const file = join(ROOT, s.src);
        assert.ok(existsSync(file), `${page} loads missing ${s.src}`);
        assert.doesNotThrow(() => new vm.Script(readFileSync(file, 'utf8'), { filename: s.src }));
      });
  });
}

test('home.html pins its remote scripts with an integrity hash', () => {
  const html = readFileSync(join(ROOT, 'home.html'), 'utf8');
  const remote = scriptTags(html).filter((s) => /^https?:/.test(s.src));
  assert.ok(remote.length > 0);
  remote.forEach((s) => assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `home.html loads ${s.src} unpinned`));
});
