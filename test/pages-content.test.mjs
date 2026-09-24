// The copy and structure each way-in page carries: Programs from the retailer one-pager,
// Open market from the original risk narrative and the four sectors.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (page) => readFileSync(join(ROOT, page), 'utf8');
const PROGRAMS = read('programs.html');
const MARKET = read('open-market.html');
const texts = (html, re) => [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&middot;/g, '·'));

test('programs.html opens on a dashboard of what a book review imports', () => {
  const dash = PROGRAMS.slice(PROGRAMS.indexOf('<figure class="dash'), PROGRAMS.indexOf('</figure>'));
  assert.deepEqual(texts(dash, /<div class="dash-tile">([\s\S]*?)<\/div>/g), [
    '500SOVs imported',
    '729Loss runs imported',
  ]);
  assert.doesNotMatch(dash, /\d+%<\/em>/, 'a progress row states a percentage nobody supplied');
});

test('programs.html carries the retailer one-pager: headline, three figures, seven rows, five capabilities', () => {
  assert.ok(PROGRAMS.includes('Your best book deserves a <em>program</em>, not another remarket.'));
  assert.deepEqual(texts(PROGRAMS, /<dt class="ed">([^<]+)<\/dt>/g), ['$30B+', '&gt;30 Days', 'One negotiated form']);
  const rows = texts(PROGRAMS, /<li><span class="ed">([^<]+)<\/span>/g);
  assert.equal(rows.length, 7);
  assert.equal(rows[0], 'Fragmented placements across 100+ carriers and forms.');
  assert.deepEqual(texts(PROGRAMS, /<li><b>0\d<\/b><strong>([^<]+)<\/strong>/g), [
    'Identify',
    'Enrich',
    'Pre-underwrite',
    'Administer',
    'Monitor',
  ]);
  assert.ok(PROGRAMS.includes('which segment of your book has the most in common with itself?'));
  assert.ok(!PROGRAMS.includes('Book roll'), 'the old book-roll chain is gone');
});

test('open-market.html heads four sectors, construction tagged environmental', () => {
  assert.deepEqual(texts(MARKET, /<h3>([^<]+)<\/h3>\s*<p>/g).slice(0, 4), [
    'Construction',
    'Real Estate',
    'Energy',
    'And More',
  ]);
  const construction = MARKET.slice(MARKET.indexOf('<h3>Construction</h3>'), MARKET.indexOf('<h3>Real Estate</h3>'));
  assert.ok(construction.includes('<span class="chip">Environmental</span>'));
});

test('open-market.html: the risk-narrative heading is editable and the slides carry only the narrative', () => {
  assert.ok(MARKET.includes('<h3 class="ed">Read the risk from the record, not the headline.</h3>'));
  assert.ok(MARKET.includes('<p class="rn-lede ed">'));
  assert.ok(!MARKET.includes('rn-foot'), 'the closing line under the slides is cut');
  assert.deepEqual(
    texts(MARKET, /<ul class="lines-points">([\s\S]*?)<\/ul>/g).length,
    1,
    'only the casualty slide has a read',
  );
  assert.ok(MARKET.includes('Since 2010, there have been 1,349 pipeline related incidents involving ignitions'));
});

test('open-market.html: the audience sections are named for their reader, with no handwritten label', () => {
  assert.deepEqual(texts(MARKET, /<div class="how-head">([\s\S]*?)<\/div>/g), ['For Retailers', 'For Underwriters']);
  assert.equal((MARKET.match(/class="steps steps-stack"/g) || []).length, 2);
});

test('no page carries the footer blurb', () => {
  ['home.html', 'open-market.html', 'programs.html'].forEach((page) => {
    assert.ok(!read(page).includes('f-note'), `${page} still has the footer blurb`);
  });
});
