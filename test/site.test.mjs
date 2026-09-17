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

test('serves at least the home page', () => {
  assert.ok(PAGES.includes('home.html'));
});

for (const page of PAGES) {
  const html = readFileSync(join(ROOT, page), 'utf8');

  test(`${page}: every inline script parses`, () => {
    inlineScripts(html).forEach((code, i) => {
      assert.doesNotThrow(() => new vm.Script(code, { filename: `${page}#script${i}` }));
    });
  });

  test(`${page}: every local script file exists`, () => {
    scriptTags(html)
      .filter((s) => !/^https?:/.test(s.src))
      .forEach((s) => assert.ok(existsSync(join(ROOT, s.src)), `${page} loads missing ${s.src}`));
  });

  test(`${page}: every local stylesheet exists`, () => {
    [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((href) => !/^https?:/.test(href))
      .forEach((href) => assert.ok(existsSync(join(ROOT, href)), `${page} loads missing ${href}`));
  });
}

const HOME = readFileSync(join(ROOT, 'home.html'), 'utf8');
const LINES = HOME.slice(HOME.indexOf('<section id="lines"'), HOME.indexOf('<section id="human"'));

test('home.html: #lines sits between #ways and #human, and the spine lists it', () => {
  assert.ok(HOME.indexOf('<section id="ways"') < HOME.indexOf('<section id="lines"'));
  assert.ok(LINES.length > 0 && LINES.lastIndexOf('</section>') > 0);
  assert.match(HOME, /\['lines',\s+'Casualty & property'\]/);
});

// The edit layer keys saved copy by index into querySelectorAll(data-selector), so one
// matching element above the footer moves every saved edit onto the wrong words. No
// ancestor of #lines matches a selector's first part, so checking that part is enough.
test('home.html: #lines adds nothing the edit layer selects', () => {
  const selector = HOME.match(/id="arqu-edit-layer"[^>]*data-selector="([^"]+)"/)[1];
  const classes = new Set([...LINES.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  selector.split(',').map((s) => s.trim().split(/\s+/)[0]).forEach((head) => {
    if (head.startsWith('.')) assert.ok(!classes.has(head.slice(1)), `#lines uses ${head}`);
    else assert.doesNotMatch(LINES, new RegExp(`<${head}\\b`), `#lines uses <${head}>`);
  });
});

test('home.html: each printed count in the dot matrix equals its data-count', () => {
  const stacks = [...LINES.matchAll(/data-count="(\d+)"[^>]*><span class="dots-n">([\d,]+)</g)];
  assert.deepEqual(stacks.map((m) => [m[1], m[2]]), [['1349', '1,349'], ['3324', '3,324'], ['1', '1']]);
  stacks.forEach((m) => assert.equal(Number(m[1]).toLocaleString('en-US'), m[2]));
});

test('home.html: the casualty chart names both sources, and the hail map is the self-hosted copy', () => {
  assert.match(LINES, /class="dots-source">Sources: Pipeline and Hazardous Materials Safety Administration \(PHMSA\) incident data; National Interagency Fire Center</);
  const src = LINES.match(/<iframe src="([^"]+)"[^>]*data-id="visualisation\/26638881"/)[1];
  assert.equal(src, 'vendor/flourish-hail-map/index.html');
  assert.ok(existsSync(join(ROOT, src)));
  assert.match(HOME, /<script src="home-lines\.js"><\/script>/);
});

// The Flourish export carries its datasets inline, and this repo publishes to a public
// GitHub Pages site. A re-export must not bring insured property rows or a data download.
function stringEnd(html, quote) {
  for (let i = quote + 1; i < html.length; i++) {
    if (html[i] === '\\') i++;
    else if (html[i] === '"') return i;
  }
  return html.length;
}

function flourishGlobal(html, name) {
  const at = html.search(new RegExp(`\\b${name}\\s*=\\s*\\{`));
  if (at < 0) throw new Error(`${name} is not in the export`);
  const start = html.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '"') i = stringEnd(html, i);
    else if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  throw new Error(`${name} never closes`);
}

test('vendor/flourish-hail-map carries no insured property rows and no data download', () => {
  const html = readFileSync(join(ROOT, 'vendor/flourish-hail-map/index.html'), 'utf8');
  const data = flourishGlobal(html, '_Flourish_data');
  assert.deepEqual(data.events, []);
  assert.ok(data.regions_map.length > 0);
  assert.equal(flourishGlobal(html, '_Flourish_settings')['layout.footer_note_secondary'], '');
});

test('home.html pins its remote scripts with an integrity hash', () => {
  const html = readFileSync(join(ROOT, 'home.html'), 'utf8');
  const remote = scriptTags(html).filter((s) => /^https?:/.test(s.src));
  assert.ok(remote.length > 0);
  remote.forEach((s) => assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `home.html loads ${s.src} unpinned`));
});
