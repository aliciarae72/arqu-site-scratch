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
const ENTITIES = { '&middot;': '·', '&gt;': '>', '&lt;': '<', '&amp;': '&' };
// The text of each match, tags stripped and the entities the pages use decoded.
const texts = (html, re) =>
  [...html.matchAll(re)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/&(?:middot|gt|lt|amp);/g, (e) => ENTITIES[e]),
  );

test('programs.html opens on the loss scatter, labelled illustrative, with its key and no zoom controls', () => {
  const start = PROGRAMS.indexOf('<figure class="book-chart');
  assert.ok(start > 0, 'the hero has no book-chart figure');
  const fig = PROGRAMS.slice(start, PROGRAMS.indexOf('</figure>', start));
  assert.match(fig, /<span>Losses in a sample book<\/span><em>Illustrative<\/em>/);
  for (const hook of ['data-book-chart', 'data-bz-stage', 'data-bz-svg', 'data-bz-ratio', 'data-bz-count']) {
    assert.ok(fig.includes(hook), `the figure has no ${hook}`);
  }
  for (const gone of ['data-bz-replay', 'data-bz-note', 'data-bz-who', 'book-zoom', 'in view']) {
    assert.ok(!PROGRAMS.includes(gone), `the zoom's ${gone} is still on the page`);
  }
  assert.deepEqual(texts(fig, /<\/i>([^<]+)<\/span>/g), [
    'One account; dot area is the loss',
    'No loss, jittered around 0%',
  ]);
  assert.ok(!PROGRAMS.includes('class="dash'), 'the old dashboard is still on the page');
  assert.ok(
    PROGRAMS.includes(
      '<script src="home-book-data.js"></script>\n<script src="home-book-axes.js"></script>\n<script src="home-book-chart.js"></script>',
    ),
    'the chart scripts are missing or out of order',
  );
});

// The one-pager's substance, set in the site's own parts: dot-marked figures, the paired
// panels the Open market audiences use, counted steps, and a closing call.
test("programs.html carries the one-pager in the site's own layout", () => {
  assert.ok(PROGRAMS.includes('Your best book deserves a <em>program</em>, not another remarket.'));
  const figures = PROGRAMS.slice(PROGRAMS.indexOf('<div class="figures'), PROGRAMS.indexOf('<div class="book-data'));
  assert.deepEqual(texts(figures, /<h3>([^<]+)<\/h3>/g), ['$30B+', '>30 days', 'One form']);
  assert.deepEqual(texts(PROGRAMS, /<div class="how-head"><h3>([^<]+)<\/h3>/g), [
    'Your book, read as one',
    'Your book today',
    'Inside an arqu program',
    'What we build around your book',
  ]);
  assert.equal((PROGRAMS.match(/class="steps steps-stack"/g) || []).length, 2);
  assert.deepEqual(texts(PROGRAMS, /<li><b>0\d<\/b><strong>([^<]+)<\/strong>/g).slice(-5), [
    'Identify',
    'Enrich',
    'Pre-underwrite',
    'Administer',
    'Monitor',
  ]);
  assert.ok(PROGRAMS.includes('Which segment of your book has the most in <em>common</em> with itself?'));
  ['pg-compare', 'pg-stats', 'pg-caps', 'Book roll'].forEach((gone) => {
    assert.ok(!PROGRAMS.includes(gone), `programs.html still carries ${gone}`);
  });
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

test('open-market.html: the risk-narrative heading is editable and the closing line is cut', () => {
  assert.ok(MARKET.includes('<h3 class="ed">The headline says no. The record says otherwise.</h3>'));
  assert.ok(MARKET.includes('<p class="rn-lede ed">'));
  assert.ok(!MARKET.includes('rn-foot'), 'the closing line under the slides is cut');
});

test('open-market.html: the audience sections are named for their reader, with no handwritten label', () => {
  assert.deepEqual(texts(MARKET, /<div class="how-head">([\s\S]*?)<\/div>/g), ['For Retailers', 'For Underwriters']);
  assert.equal((MARKET.match(/class="steps steps-stack"/g) || []).length, 2);
});

// Each slide says in words what its figure shows, and every number it names is on the figure.
test('open-market.html: each risk-narrative slide carries a read whose figures come from its chart', () => {
  const reads = texts(MARKET, /<p class="rn-read">([^<]+)<\/p>/g);
  assert.equal(reads.length, 2);
  for (const n of ['1,349', '3,324']) {
    assert.ok(MARKET.includes(`<span class="dots-n">${n}</span>`) && reads[0].includes(n), `${n} is not on both`);
  }
  assert.match(reads[0], /one wildfire a pipeline directly caused/);
  assert.match(reads[1], /11,026 grid cells rate very low/);
  assert.match(MARKET, /alt="[^"]*11,026 grid cells rate Very Low/);
});

// The audience copy leads with outcomes and the bar we hold, not a broker's process outline.
test('open-market.html: For Retailers and For Underwriters each open on a beyond-the-ask line', () => {
  assert.deepEqual(texts(MARKET, /<p class="aud-lede">([^<]+)<\/p>/g), [
    'Most wholesalers place what you send. We send it out better than it arrived.',
    'Every submission meets the bar you would set yourself, and we build our own tools to clear it.',
  ]);
  const titles = texts(MARKET, /<li><b>0\d<\/b><strong>([^<]+)<\/strong>/g);
  assert.deepEqual(titles, [
    'More back than you sent',
    'A yes where others hear no',
    'Terms you can stand behind',
    'Flow that fits your appetite',
    'The file you would have built',
    'Risks you are not seeing',
  ]);
  for (const gone of ['Send us the submission', 'We pre-underwrite it', 'We engage the right markets']) {
    assert.ok(!MARKET.includes(gone), `the process step "${gone}" is still there`);
  }
});

// Each row of a Programs book panel as [label, percent], so the hero can be held to the same book.
function panelRows(caption) {
  const at = PROGRAMS.indexOf(`<figcaption>${caption}`);
  const list = PROGRAMS.slice(at, PROGRAMS.indexOf('</ul>', at));
  return [...list.matchAll(/<span>([^<]+)<\/span><i style="--w:\d+%"><\/i><b>(\d+)%<\/b>/g)].map((m) => [m[1], m[2]]);
}

test("open-market.html's hero draws the Programs sample book: loss ratio by year and CAT exposure", () => {
  assert.ok(MARKET.includes('<figure class="risk-hero'), 'the hero has no risk visual');
  for (const gone of ['class="sheet', 'class="dash']) {
    assert.ok(!MARKET.includes(gone), `the hero still carries ${gone}`);
  }
  const years = [
    ...MARKET.matchAll(/<div class="rh-col" style="--v:(\d+);--k:\d"><b>(\d+)%<\/b><i><\/i><span>(\d{4})<\/span>/g),
  ];
  for (const [, v, shown] of years) assert.equal(v, shown);
  assert.deepEqual(
    years.map(([, , shown, year]) => [year, shown]),
    panelRows('Loss ratio by year'),
  );
  const perils = [
    ...MARKET.matchAll(/<li style="--w:(?:\d+);--k:\d"><span>([^<]+)<\/span><i><\/i><b>(\d+)%<\/b><\/li>/g),
  ].map((m) => [m[1], m[2]]);
  assert.deepEqual(perils, panelRows('CAT exposure'));
});

test('programs.html reads a sample book four ways, labelled as illustrative, each bar drawn to its figure', () => {
  const start = PROGRAMS.indexOf('<div class="book-data');
  const data = PROGRAMS.slice(start, PROGRAMS.indexOf('<div class="audiences">', start));
  assert.match(data, /Sample book &middot; illustrative figures/);
  assert.deepEqual(
    texts(data, /<figcaption>([^<]+)<\/figcaption>/g).map((c) => c.split(' · ')[0]),
    ['TIV by class', 'Loss ratio by year', 'CAT exposure', 'Limits'],
  );
  const percentRows = [...data.matchAll(/--w:(\d+)%"><\/i><b>(\d+)%<\/b>/g)];
  assert.equal(percentRows.length, 15);
  percentRows.forEach(([, width, shown]) => {
    assert.equal(width, shown, `a bar drawn at ${width}% says ${shown}%`);
  });
});

test('home, open market and programs each carry the values section, word for word', () => {
  [read('home.html'), MARKET, PROGRAMS].forEach((page) => {
    const start = page.indexOf('<section id="values"');
    const values = page.slice(start, page.indexOf('</section>', start));
    assert.deepEqual(texts(values, /<p class="eyebrow">([^<]+)<\/p>/g), ['Our values']);
    assert.deepEqual(texts(values, /<h2 id="values-title">([^<]+)<\/h2>/g), ['Service is our product']);
    assert.deepEqual(texts(values, /<h3>([^<]+)<\/h3>/g), ['Expertise', 'Execution', 'Innovation']);
    assert.deepEqual(texts(values, /<\/h3>\s*<p>([^<]+)<\/p>/g), [
      'Everything we build exists to help you grow your business. Our brokers leverage their expertise to consult with you for better solutions.',
      'Our technology automates the paperwork and prioritizes the relationship, so our brokers spend more time with you.',
      'We work with the latest technology to get deeper insights into risk',
    ]);
  });
});

test('no page carries the footer blurb', () => {
  ['home.html', 'open-market.html', 'programs.html'].forEach((page) => {
    assert.ok(!read(page).includes('f-note'), `${page} still has the footer blurb`);
  });
});
