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

function assertLocalFilesExist(page, refs) {
  refs
    .filter((ref) => !/^https?:/.test(ref))
    .forEach((ref) => assert.ok(existsSync(join(ROOT, ref)), `${page} loads missing ${ref}`));
}

test('serves at least the home page', () => {
  assert.ok(PAGES.includes('home.html'));
});

test('home.html links its split stylesheets and scripts, in load order', () => {
  const html = readFileSync(join(ROOT, 'home.html'), 'utf8');
  assert.deepEqual(
    stylesheetHrefs(html).filter((h) => h.startsWith('home')),
    ['home.css', 'home-layers.css', 'home-spine.css', 'home-hand.css', 'home-risk-narrative.css', 'home-lines.css'],
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
      'home-hand-marks.js',
      'home-sector-icons.js',
      'home-handshake.js',
      'home-ambient.js',
      'home-lines.js',
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
    assertLocalFilesExist(page, stylesheetHrefs(html));
  });

  test(`${page}: every local script file exists and parses`, () => {
    assertLocalFilesExist(
      page,
      scriptTags(html).map((s) => s.src),
    );
    scriptTags(html)
      .filter((s) => !/^https?:/.test(s.src))
      .forEach((s) => {
        const code = readFileSync(join(ROOT, s.src), 'utf8');
        assert.doesNotThrow(() => new vm.Script(code, { filename: s.src }));
      });
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
  // the spine list and the reveal pass live in the split interaction script
  const interaction = readFileSync(join(ROOT, 'home-interaction.js'), 'utf8');
  assert.match(interaction, /\['lines',\s+'Casualty & property'\]/);
  assert.match(interaction, /var RISE =[^;]*\.dots-chart/s);
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

// Rendering the map fetches tiles and fonts from these four at run time, measured in Chrome.
// The page says so, so a host added to the frame without a word to the visitor fails here.
const MAP_HOSTS = [
  'server.arcgisonline.com',
  'tiles.flourish.studio',
  'public.flourish.studio',
  'openmaptiles.github.io',
];

function disclosedHosts(html) {
  return [...html.matchAll(/class="(?:fig-note|f-note)">([^<]+)</g)].map((m) => m[1]).join(' ');
}

test('home.html: the hail panel names every third party the map reaches', () => {
  const note = LINES.match(/class="fig-note">([^<]+)</)[1];
  MAP_HOSTS.forEach((host) => assert.ok(note.includes(host), `the note omits ${host}`));
});

// The map's hosts live inside the vendored export, so they are listed above. These are the
// ones home.html asks for itself, and a new one has to arrive with a word to the visitor.
test('home.html: every off-origin host in its own markup is named in a note', () => {
  const hosts = new Set([...HOME.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => new URL(m[1]).host));
  const notes = disclosedHosts(HOME);
  hosts.forEach((host) => assert.ok(notes.includes(host), `home.html loads ${host}, and no note names it`));
});

const INSURED_COLUMNS = new Set(['name', 'address', 'city', 'zip', 'tiv', 'latitude', 'longitude']);

test('vendor/flourish-hail-map carries no insured property data and no data download', () => {
  const html = readFileSync(join(ROOT, 'vendor/flourish-hail-map/index.html'), 'utf8');
  const data = flourishGlobal(html, '_Flourish_data');
  // regions_map is the NOAA hail-severity grid; every other dataset held the book
  Object.entries(data).forEach(([name, rows]) => {
    if (name !== 'regions_map') assert.deepEqual(rows, [], `${name} carries rows`);
  });
  assert.ok(data.regions_map.length > 0);
  // a binding still names a column of the book after its rows are gone, in any dataset
  Object.entries(flourishGlobal(html, '_Flourish_data_column_names')).forEach(([dataset, binding]) => {
    Object.values(binding)
      .flat()
      .forEach((column) => {
        assert.ok(!INSURED_COLUMNS.has(String(column).toLowerCase()), `${dataset} binds ${column}`);
      });
  });
  // Flourish draws a download button from whichever footer note carries this token
  Object.entries(flourishGlobal(html, '_Flourish_settings'))
    .filter(([key]) => key.startsWith('layout.footer_note'))
    .forEach(([key, note]) => assert.doesNotMatch(String(note), /download_data/, `${key} offers the data download`));
});

test('home.html pins its remote scripts with an integrity hash', () => {
  const remote = scriptTags(HOME).filter((s) => /^https?:/.test(s.src));
  assert.ok(remote.length > 0);
  remote.forEach((s) => assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `home.html loads ${s.src} unpinned`));
});
