// The About, Construction and Energy drafts: the team as arqu.com lists it, the two
// practice pages, and the links that reach all three from every page.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (page) => readFileSync(join(ROOT, page), 'utf8');
const PAGES = ['home.html', 'open-market.html', 'programs.html', 'about.html', 'construction.html', 'energy.html'];

// Names and titles exactly as the arqu.com About page lists them, in its order.
const TEAM = [
  ['alicia', 'Alicia', 'Head of Product'],
  ['ben', 'Ben', 'Real Estate Practice Lead'],
  ['chi', 'Chi', 'Co-Founder &amp; CEO'],
  ['gian', 'Gian', 'Team Lead - Construction &amp; Energy'],
  ['jon', 'Jon', 'Head of Engineering'],
  ['justin', 'Justin', 'President, Brokerage'],
  ['kate', 'Kate', 'Account Executive'],
  ['shawn', 'Shawn', 'Dir. of Business Development - Construction &amp; Energy'],
];
const people = (html) =>
  [
    ...html.matchAll(
      /<li class="person"><img src="images\/team\/([a-z]+)\.jpg" alt="([^"]+)"[^>]*><b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g,
    ),
  ].map(([, slug, alt, name, title]) => {
    assert.equal(alt, name, `${slug}'s photo is not described by their name`);
    return [slug, name, title];
  });

test('about.html lists the whole team with the photos and titles arqu.com uses', () => {
  assert.deepEqual(people(read('about.html')), TEAM);
  TEAM.forEach(([slug]) => {
    assert.ok(existsSync(join(ROOT, `images/team/${slug}.jpg`)), `images/team/${slug}.jpg is missing`);
  });
});

for (const [page, kind, heads] of [
  ['construction.html', 'construction', ["Builder's risk", "Contractors' casualty", 'Environmental']],
  ['energy.html', 'energy', ['Projects', 'Contractors', 'Operators']],
]) {
  test(`${page} heads its practice with its icon, three columns and its two practice leads`, () => {
    const html = read(page);
    assert.ok(html.includes(`<div class="flow" id="flow-${kind}">`));
    assert.ok(html.includes(`<svg class="sector-icon" data-icon="${kind}"`));
    const cols = html.slice(html.indexOf('<div class="figures sector-cols">'), html.indexOf('<div class="audiences">'));
    assert.deepEqual(
      [...cols.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]),
      heads,
    );
    assert.deepEqual(
      people(html).map(([slug]) => slug),
      ['gian', 'shawn'],
    );
    assert.ok(
      read('open-market.html').includes(`<a class="go" href="${page}">`),
      `open-market.html does not link to ${page}`,
    );
  });
}

test('every page links to About in its header, and to all three new pages in its footer', () => {
  PAGES.forEach((page) => {
    const html = read(page);
    const nav = html.slice(html.indexOf('<nav class="nav"'), html.indexOf('</nav>', html.indexOf('<nav class="nav"')));
    assert.ok(nav.includes('<a href="about.html">About</a>'), `${page} header has no About link`);
    const foot = html.slice(
      html.indexOf('<nav class="f-links"'),
      html.indexOf('</nav>', html.indexOf('<nav class="f-links"')),
    );
    ['construction.html', 'energy.html', 'about.html'].forEach((target) => {
      assert.ok(foot.includes(`href="${target}"`), `${page} footer has no link to ${target}`);
    });
  });
});
