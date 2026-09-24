// Unit checks for home-book-data.js: the seeded sample book the Programs hero plots.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const data = require('./home-book-data.js');

test('the sample book is 240 accounts, the same on every load, led by one 87% loss', () => {
  const book = data.buildBook();
  assert.equal(book.length, 240);
  assert.deepEqual(data.buildBook(), book);
  assert.deepEqual(book[0], { premium: 1200000, loss: 1044000, focus: true });
  assert.equal(book.filter((a) => a.focus).length, 1);
  assert.ok(
    book.slice(1).every((a) => a.loss < book[0].loss),
    'another account out-loses the focus',
  );
  assert.ok(
    book.some((a) => a.loss === 0),
    'no loss-free account to balance the book',
  );
  assert.ok(book.slice(1).every((a) => a.premium >= 40000 && a.premium <= 400000 && a.loss <= a.premium * 0.75));
});

test('a different seed makes a different book', () => {
  assert.notDeepEqual(data.buildBook(1, 10), data.buildBook(2, 10));
  assert.equal(data.buildBook(1, 10).length, 10);
});

test('seededRandom repeats for a seed and stays in [0, 1)', () => {
  const a = data.seededRandom(7);
  const b = data.seededRandom(7);
  const draws = Array.from({ length: 200 }, () => a());
  assert.deepEqual(
    draws,
    Array.from({ length: 200 }, () => b()),
  );
  assert.ok(draws.every((v) => v >= 0 && v < 1));
});

test('lossRatio is losses over premium, and zero for an empty set; the book runs 27%', () => {
  assert.equal(
    data.lossRatio([
      { premium: 100, loss: 30 },
      { premium: 300, loss: 10 },
    ]),
    0.1,
  );
  assert.equal(data.lossRatio([]), 0);
  assert.equal(data.percent(data.lossRatio(data.buildBook())), '27%');
});

test('percent rounds to a whole percent', () => {
  assert.equal(data.percent(0.8651), '87%');
  assert.equal(data.percent(0), '0%');
});
