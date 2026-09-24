// Unit checks for home-book-data.js: the seeded sample book the Programs chart plots.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const data = require('./home-book-data.js');

const BOOK = data.buildBook();
const REST = BOOK.slice(1);

test('the sample book is 240 accounts, the same on every load, led by one 87% loss', () => {
  assert.equal(BOOK.length, 240);
  assert.deepEqual(data.buildBook(), BOOK);
  assert.deepEqual(BOOK[0], { premium: 1200000, loss: 1044000, focus: true });
  assert.equal(BOOK.filter((a) => a.focus).length, 1);
  assert.ok(
    REST.every((a) => a.loss < BOOK[0].loss),
    'another account out-loses the focus',
  );
});

test('premiums and loss ratios stay in range, and none piles up on a bound', () => {
  const { PREMIUM, LOSS_RATIO } = data;
  const premiums = REST.map((a) => a.premium);
  assert.ok(premiums.every((p) => p >= PREMIUM.min - 1 && p <= PREMIUM.max + 1));
  const ratios = REST.filter((a) => a.loss).map((a) => a.loss / a.premium);
  assert.ok(ratios.every((r) => r >= LOSS_RATIO.min - 1e-4 && r <= LOSS_RATIO.max + 1e-4));
  const atBound = (values, lo, hi, tol) => values.filter((v) => v - lo < tol || hi - v < tol).length;
  assert.ok(atBound(premiums, PREMIUM.min, PREMIUM.max, 500) <= 2, 'premiums pile up on a bound');
  assert.ok(atBound(ratios, LOSS_RATIO.min, LOSS_RATIO.max, 0.002) <= 2, 'loss ratios pile up on a bound');
});

test('the spread is skewed like a real book: most accounts small and light, a long tail of large and heavy', () => {
  const premiums = REST.map((a) => a.premium).sort((a, b) => a - b);
  const median = premiums[Math.floor(premiums.length / 2)];
  const mean = premiums.reduce((s, p) => s + p, 0) / premiums.length;
  assert.ok(mean > median * 1.1, `premiums are not right-skewed (mean ${mean}, median ${median})`);
  const lossFree = REST.filter((a) => a.loss === 0).length;
  assert.ok(lossFree > 40 && lossFree < 100, `${lossFree} loss-free accounts`);
});

test('lognormal draws again rather than clamping, so every draw lands inside the range', () => {
  const random = data.seededRandom(3);
  const draws = Array.from({ length: 500 }, () => data.lognormal(random, { median: 1, spread: 2, min: 0.5, max: 2 }));
  assert.ok(draws.every((v) => v >= 0.5 && v <= 2));
  assert.ok(new Set(draws).size > 490, 'draws repeat, as clamping would make them');
});

test('normal draws centre on zero with unit spread', () => {
  const random = data.seededRandom(11);
  const draws = Array.from({ length: 4000 }, () => data.normal(random));
  const mean = draws.reduce((s, v) => s + v, 0) / draws.length;
  const sd = Math.sqrt(draws.reduce((s, v) => s + (v - mean) ** 2, 0) / draws.length);
  assert.ok(Math.abs(mean) < 0.06 && Math.abs(sd - 1) < 0.06, `mean ${mean}, sd ${sd}`);
});

test('a different seed makes a different book', () => {
  assert.notDeepEqual(data.buildBook(1, 10), data.buildBook(2, 10));
  assert.equal(data.buildBook(1, 10).length, 10);
});

test('lossRatio is losses over premium, and zero for an empty set; the book runs 22%', () => {
  assert.equal(
    data.lossRatio([
      { premium: 100, loss: 30 },
      { premium: 300, loss: 10 },
    ]),
    0.1,
  );
  assert.equal(data.lossRatio([]), 0);
  assert.equal(data.percent(data.lossRatio(BOOK)), '22%');
});

test('percent rounds to a whole percent', () => {
  assert.equal(data.percent(0.8651), '87%');
  assert.equal(data.percent(0), '0%');
});
