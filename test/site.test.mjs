// Static checks for the pages GitHub Pages serves from this repo. There is no
// build step, so a syntax error in an inline <script> or a missing sibling file
// only shows up as a broken page in someone's browser. These catch both first.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import hailGrid from '../hail-grid.js';
import cells from './../scripts/hail-cells.js';

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
    'home.css', 'home-layers.css', 'home-spine.css', 'home-hand.css', 'home-risk-narrative.css', 'home-lines.css'
  ]);
  assert.deepEqual(scriptTags(html).map((s) => s.src.replace(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(roughjs)@.*$/, '$1')), [
    'home-flows.js', 'home-interaction.js', 'home-risk-narrative.js', 'home-card-art.js',
    'roughjs', 'home-hand.js', 'home-handshake.js', 'home-ambient.js',
    'home-lines.js', 'hail-grid.js', 'home-hail-map.js', 'home-hail-map-ui.js', 'arqu-edit-layer.js'
  ]);
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

// The casualty/property material now rides the open-market carousel rather than
// its own #lines section, so these assertions read the carousel block.
const HAIL = JSON.parse(readFileSync(join(ROOT, 'data/hail-severity.json'), 'utf8'));
const LINES = HOME.slice(HOME.indexOf('<div class="rn reveal"'), HOME.indexOf('<div class="how reveal"'));

test('home.html: the casualty material rides the open-market carousel, and the page wires it up', () => {
  // It sits inside #ways now, above "How it works" and below the three verticals.
  assert.ok(HOME.indexOf('<div class="branches">') < HOME.indexOf('<div class="rn reveal"'));
  assert.ok(HOME.indexOf('<div class="rn reveal"') < HOME.indexOf('<div class="how reveal"'));
  assert.ok(!HOME.includes('<section id="lines"'), 'the standalone #lines section is gone');
  const interaction = readFileSync(join(ROOT, 'home-interaction.js'), 'utf8');
  assert.match(interaction, /\['ways',/, 'the spine list is read from the file that holds it');
  assert.ok(!/\['lines',/.test(interaction), 'the spine no longer points at a section that does not exist');
  // The slides and pagination she asked to keep still carry it.
  assert.equal((LINES.match(/class="rn-slide[ "]/g) || []).length, 2);
  assert.equal((LINES.match(/class="rn-pip"/g) || []).length, 2);
  // the chart fills on .seen, which the page's own reveal pass adds
  assert.match(interaction, /var RISE = [^;]*\.dots-chart/s);
});

// Under the edit layer's DOM-index fallback (when its one-time migration refuses), one
// added element matching data-selector moves saved edits onto the wrong words. No ancestor
// of #lines matches a selector's first compound, so checking that compound is enough.
// Scoped to the two figures, not the whole carousel: the carousel's head carried
// an .eyebrow long before this material moved in, and the guard is about what the
// move ADDS, not about re-litigating the block it landed in.
const MOVED = [...LINES.matchAll(/<div class="rn-vis[^"]*">[\s\S]*?<\/figure>/g)].map((m) => m[0]).join('\n');

test('home.html: the moved casualty material adds nothing the edit layer selects', () => {
  const selector = HOME.match(/id="arqu-edit-layer"[^>]*data-selector="([^"]+)"/)[1];
  const classes = new Set([...MOVED.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  assert.ok(MOVED.includes('dots-chart') && MOVED.includes('hail-frame'), 'both figures are in scope');
  selector
    .split(',')
    .map((s) => s.trim().split(/\s+/)[0])
    .forEach((head) => {
      if (head.startsWith('.')) assert.ok(!classes.has(head.slice(1)), `the moved material uses ${head}`);
      else assert.doesNotMatch(MOVED, new RegExp(`<${head}\\b`), `the moved material uses <${head}>`);
    });
});

test('home.html: each printed count in the dot matrix equals its data-count', () => {
  const stacks = [...LINES.matchAll(/<div class="dots-stack"[^>]*>[\s\S]*?<\/span>/g)].map((m) => ({
    count: m[0].match(/data-count="(\d+)"/)[1],
    printed: m[0].match(/class="dots-n">([\d,]+)</)[1],
  }));
  assert.deepEqual(
    stacks.map((s) => s.count),
    ['1349', '3324', '1'],
  );
  stacks.forEach((s) => {
    assert.equal(Number(s.count).toLocaleString('en-US'), s.printed);
  });
});

test('home.html: the casualty chart names both sources, and the hail map is drawn from this repo', () => {
  const source = LINES.match(/class="fig-source">([^<]+)</)[1];
  assert.match(source, /Pipeline and Hazardous Materials Safety Administration/);
  assert.match(source, /National Interagency Fire Center/);
  const src = LINES.match(/<img src="(hail-severity\.svg)"/)[1];
  assert.ok(existsSync(join(ROOT, src)), 'the map SVG ships with the site');
  assert.ok(scriptTags(HOME).some((tag) => tag.src === 'home-lines.js'));
});

// The map is markup now, not an opaque embed, so its parts can be asserted the way the
// casualty chart's are. It draws Colorado, so the copy counts what it draws: a cell whose
// centre falls inside the state line. The extract runs past that line to the north and the
// south-west, and those cells are neither drawn nor counted.
// The frame and the rule both come from the shipped grid and the module that reads it, so
// a re-extract with a different span cannot leave this test counting the old box while the
// map draws the new one.
const GRID = hailGrid;
const DRAWN = cells.drawnCells(GRID.frame, HAIL.cells);

test("home.html: the hail slide's counts match the data it ships", () => {
  const fig = LINES.slice(LINES.indexOf('02 &middot; Property'));
  const tally = {};
  DRAWN.forEach(([c]) => {
    tally[HAIL.categories[c]] = (tally[HAIL.categories[c]] || 0) + 1;
  });
  const shown = (n) => assert.ok(fig.includes(n.toLocaleString('en-US')), `the slide does not say ${n}`);
  assert.ok(DRAWN.length < HAIL.cells.length, 'the extract runs past the state line');
  shown(DRAWN.length);
  ['Very Low', 'Low', 'Moderate'].forEach((c) => {
    shown(tally[c]);
  });
  // The two that carry the point are spelled out rather than numeric.
  assert.equal(tally.High, 40);
  assert.match(fig, /Forty cells rate High, and one rates Very High/);
  assert.equal(tally['Very High'], 1);
});

test('home.html: the hail figure carries a caption, a legend and its sources', () => {
  const fig = LINES.slice(LINES.indexOf('<figure class="hail-frame">'));
  assert.match(fig, /class="dots-title">Hail severity, Colorado</);
  assert.match(fig, /class="dots-sub">NOAA storm records/);
  // One legend row per severity class the data actually carries, same order.
  const swatches = [...fig.matchAll(/class="hail-key"[\s\S]*?<\/ul>/g)][0][0];
  const labels = [...swatches.matchAll(/<\/i>([^<]+)</g)].map((m) => m[1].trim().toLowerCase());
  assert.deepEqual(
    labels,
    HAIL.categories.map((c) => c.toLowerCase()),
  );
  const source = [...fig.matchAll(/class="fig-source">([^<]+)</g)].at(-1)[1];
  assert.match(source, /NOAA Storm Events Database/);
  assert.match(source, /NOAA Severe Weather Data Inventory/);
  // The alt text has to carry the finding, not just name the file.
  const alt = fig.match(/alt="([^"]+)"/)[1];
  assert.ok(alt.includes(DRAWN.length.toLocaleString('en-US')), `the alt text does not say ${DRAWN.length}`);
  assert.match(alt, /Very High/i);
});

test('home.html: the map takes a pointer and a keyboard, and ships the grid it answers from', () => {
  const map = LINES.match(/<div class="hail-map"[\s\S]*?<\/div>\s*<\/div>/)[0];
  assert.match(map, /\btabindex="0"/, 'the map cannot be reached from the keyboard');
  assert.match(map, /\baria-label="[^"]*[Aa]rrow keys[^"]*"/, 'the label does not say what the keys do');
  ['data-hail-map', 'data-hail-pan', 'data-hail-tip', 'data-hail-dot', 'data-hail-read'].forEach((hook) => {
    assert.ok(map.includes(hook), `the map markup has no ${hook}`);
  });
  assert.match(map, /data-hail-read[^>]*aria-live="polite"/, 'the readout is not announced');
  // The carousel skips a touch that starts on a control with gestures of its own. Without
  // this attribute a drag across the map pages the slide instead of panning.
  assert.match(map, /\bdata-owns-pointer\b/, 'the map does not claim its own gestures');
  ['hail-grid.js', 'home-hail-map.js', 'home-hail-map-ui.js'].forEach((src) => {
    assert.ok(
      scriptTags(HOME).some((tag) => tag.src === src),
      `home.html does not load ${src}`,
    );
  });
  // The wiring reads the grid and the arithmetic off globals, so both load ahead of it.
  assert.ok(HOME.indexOf('hail-grid.js') < HOME.indexOf('home-hail-map-ui.js'));
  assert.ok(HOME.indexOf('home-hail-map.js') < HOME.indexOf('home-hail-map-ui.js'));
  // Shipped as a script, not fetched: a fetch is blocked on file:// and the readout dies.
  assert.doesNotMatch(readFileSync(join(ROOT, 'home-hail-map-ui.js'), 'utf8'), /\bfetch\s*\(/);
});

// The image tag has to declare the size the generator drew, or the figure reflows once
// the SVG arrives and the pointer lands on the wrong cell until it settles.
// The carousel must not claim input a slide's own control has taken: arrows that something
// inside already answered, and touches that start on a control which owns its gestures.
test('home.html: the carousel yields the keys and touches its slides have claimed', () => {
  const script = readFileSync(join(ROOT, 'home-risk-narrative.js'), 'utf8');
  const carousel = script.slice(script.indexOf("show.addEventListener('keydown'"), script.indexOf('go(0);'));
  assert.match(carousel, /if \(e\.defaultPrevented\) return;/, 'the carousel pages on a handled key');
  assert.match(
    carousel,
    /closest\('\[data-owns-pointer\]'\)/,
    'the carousel swipes from a control that owns the pointer',
  );
  // It still swipes from the rest of the slide, which is most of what a thumb can reach.
  assert.doesNotMatch(carousel, /e\.target === show/, 'only the carousel background can swipe');
});

test('home.html: the map image declares the size the SVG was drawn at', () => {
  const svg = readFileSync(join(ROOT, 'hail-severity.svg'), 'utf8');
  const [, width, height] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const img = LINES.match(/<img src="hail-severity\.svg"[^>]*>/)[0];
  assert.match(img, new RegExp(`width="${width}"`));
  assert.match(img, new RegExp(`height="${height}"`));
});

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

// The map used to fetch tiles and fonts from these four at render time. It is drawn
// from this repo now, so the guarantee flips: they must appear NOWHERE, and the
// footer must not keep promising a visitor that it reaches them.
test('home.html: the hail map reaches none of the hosts the embed used to', () => {
  const svg = readFileSync(join(ROOT, 'hail-severity.svg'), 'utf8');
  MAP_HOSTS.forEach((host) => {
    assert.ok(!HOME.includes(host), `home.html still reaches ${host}`);
    assert.ok(!svg.includes(host), `the map SVG still reaches ${host}`);
  });
  assert.doesNotMatch(svg, /<(script|image|use\s+[^>]*href="http)/, 'the map SVG pulls something in');
  const note = HOME.match(/class="f-note">([^<]+)</)[1];
  assert.match(note, /hail map is drawn from this site and reaches nobody/);
});

// The map's hosts live inside the vendored export, so they are listed above. These are the
// ones home.html asks for itself, and a new one has to arrive with a word to the visitor.
test('home.html: every off-origin host in its own markup is named in a note', () => {
  const hosts = new Set([...HOME.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => new URL(m[1]).host));
  const notes = disclosedHosts(HOME);
  hosts.forEach((host) => {
    assert.ok(notes.includes(host), `home.html loads ${host}, and no note names it`);
  });
});

const INSURED_COLUMNS = new Set(['name', 'address', 'city', 'zip', 'tiv', 'latitude', 'longitude']);

// The vendored export carried the whole book inline and had to be frisked for insured
// rows on every re-export. The extracted data is the same guarantee on a far smaller
// surface: severity plus geometry, nothing else, and it is readable in one glance.
test('data/hail-severity.json carries severity and geometry, nothing about an insured', () => {
  assert.deepEqual(Object.keys(HAIL).sort(), ['categories', 'cells']);
  assert.deepEqual(HAIL.categories, ['Very Low', 'Low', 'Moderate', 'High', 'Very High']);
  assert.equal(HAIL.cells.length, 11963);
  HAIL.cells.forEach(([category, ring], i) => {
    assert.ok(Number.isInteger(category) && HAIL.categories[category], `cell ${i} has no severity`);
    assert.equal(ring.length >= 3, true, `cell ${i} is not a polygon`);
    ring.forEach(([lon, lat]) => {
      assert.equal(typeof lon === 'number' && typeof lat === 'number', true, `cell ${i} is not numeric`);
    });
  });
  // A cell is a two-slot array. An insured column could only arrive as a third.
  HAIL.cells.forEach((cell, i) => {
    assert.equal(cell.length, 2, `cell ${i} carries an extra field`);
  });
  const raw = readFileSync(join(ROOT, 'data/hail-severity.json'), 'utf8').toLowerCase();
  INSURED_COLUMNS.forEach((column) => {
    assert.ok(!raw.includes(`"${column}"`), `the data names ${column}`);
  });
});

test('home.html pins its remote scripts with an integrity hash', () => {
  const remote = scriptTags(HOME).filter((s) => /^https?:/.test(s.src));
  assert.ok(remote.length > 0);
  remote.forEach((s) => {
    assert.match(s.tag, /\bintegrity="sha(256|384|512)-/, `home.html loads ${s.src} unpinned`);
  });
});
