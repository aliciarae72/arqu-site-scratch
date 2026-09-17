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
  return [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
}

function assertLocalFilesExist(page, refs) {
  refs
    .filter((ref) => !/^https?:/.test(ref))
    .forEach((ref) => assert.ok(existsSync(join(ROOT, ref)), `${page} loads missing ${ref}`));
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
    assertLocalFilesExist(
      page,
      scriptTags(html).map((s) => s.src),
    );
  });

  test(`${page}: every local stylesheet exists`, () => {
    assertLocalFilesExist(page, stylesheetHrefs(html));
  });
}

const HOME = readFileSync(join(ROOT, 'home.html'), 'utf8');

function sectionOf(html, id) {
  const open = html.indexOf(`<section id="${id}"`);
  return open < 0 ? '' : html.slice(open, html.indexOf('</section>', open));
}

const LINES = sectionOf(HOME, 'lines');

test('home.html: #lines sits between #ways and #human, and the page wires it up', () => {
  assert.ok(HOME.indexOf('<section id="ways"') < HOME.indexOf('<section id="lines"'));
  assert.ok(HOME.indexOf('<section id="lines"') < HOME.indexOf('<section id="human"'));
  assert.ok(LINES.includes('lines-panel'));
  assert.match(HOME, /\['lines',\s+'Casualty & property'\]/);
  // the chart fills on .seen, which the page's own reveal pass adds
  assert.match(HOME, /var RISE = [^;]*\.dots-chart/s);
});

// Under the edit layer's DOM-index fallback (when its one-time migration refuses), one
// added element matching data-selector moves saved edits onto the wrong words. No ancestor
// of #lines matches a selector's first compound, so checking that compound is enough.
test('home.html: #lines adds nothing the edit layer selects', () => {
  const selector = HOME.match(/id="arqu-edit-layer"[^>]*data-selector="([^"]+)"/)[1];
  const classes = new Set([...LINES.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  selector
    .split(',')
    .map((s) => s.trim().split(/\s+/)[0])
    .forEach((head) => {
      if (head.startsWith('.')) assert.ok(!classes.has(head.slice(1)), `#lines uses ${head}`);
      else assert.doesNotMatch(LINES, new RegExp(`<${head}\\b`), `#lines uses <${head}>`);
    });
});

test('home.html: each printed count in the dot matrix equals its data-count', () => {
  const stacks = [...LINES.matchAll(/<div class="dots-stack"[^>]*>[\s\S]*?<\/div>/g)].map((m) => ({
    count: m[0].match(/data-count="(\d+)"/)[1],
    printed: m[0].match(/class="dots-n">([\d,]+)</)[1],
  }));
  assert.deepEqual(
    stacks.map((s) => s.count),
    ['1349', '3324', '1'],
  );
  stacks.forEach((s) => assert.equal(Number(s.count).toLocaleString('en-US'), s.printed));
});

test('home.html: the casualty chart names both sources, and the hail map is the self-hosted copy', () => {
  const source = LINES.match(/class="fig-source">([^<]+)</)[1];
  assert.match(source, /Pipeline and Hazardous Materials Safety Administration/);
  assert.match(source, /National Interagency Fire Center/);
  const src = LINES.match(/<iframe src="([^"]+)"[^>]*data-id="visualisation\/26638881"/)[1];
  assert.equal(src, 'vendor/flourish-hail-map/index.html');
  assert.ok(existsSync(join(ROOT, src)));
  assert.ok(scriptTags(HOME).some((tag) => tag.src === 'home-lines.js'));
});

// The Flourish export carries its datasets inline, and this repo publishes to a public
// GitHub Pages site. A re-export must not bring insured property rows or a data download.
// The export writes each global on one line. A re-export that does not throws here.
function flourishGlobal(html, name) {
  const line = html.split('\n').find((l) => l.includes(`${name} = {`));
  if (!line) throw new Error(`${name} is not in the export`);
  return JSON.parse(line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1));
}

test('vendor/flourish-hail-map carries no insured property data and no data download', () => {
  const html = readFileSync(join(ROOT, 'vendor/flourish-hail-map/index.html'), 'utf8');
  const data = flourishGlobal(html, '_Flourish_data');
  // regions_map is the NOAA hail-severity grid; every other dataset held the book
  Object.entries(data).forEach(([name, rows]) => {
    if (name !== 'regions_map') assert.deepEqual(rows, [], `${name} carries rows`);
  });
  assert.ok(data.regions_map.length > 0);
  // the column bindings name the book's own fields (NAME, ADDRESS, ZIP, TIV), so they go too
  assert.deepEqual(flourishGlobal(html, '_Flourish_data_column_names').events, {});
  assert.equal(flourishGlobal(html, '_Flourish_settings')['layout.footer_note_secondary'], '');
});

test('home.html pins its remote scripts with an integrity hash', () => {
  const remote = scriptTags(HOME).filter((s) => /^https?:/.test(s.src));
  assert.ok(remote.length > 0);
  remote.forEach((s) => assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `home.html loads ${s.src} unpinned`));
});
