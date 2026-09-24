/* The Programs chart's sample book: seeded, so it is the same book on every load.
   Premiums and loss ratios are drawn from skewed (lognormal) spreads, the shape real
   books take: most accounts small with a long tail of large ones, most losses light
   with a few heavy. The first account is the focus, the book's single worst loss. */
(() => {
  const ACCOUNTS = 240;
  const SEED = 20260924;
  const FOCUS_LOSS_RATIO = 0.87;
  const FOCUS_PREMIUM = 1200000;
  const LOSS_FREE_SHARE = 0.28;
  const PREMIUM = { median: 140000, spread: 0.62, min: 32000, max: 900000 };
  const LOSS_RATIO = { median: 0.3, spread: 0.75, min: 0.01, max: 0.78 };

  /* mulberry32 */
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* one standard normal draw (Box-Muller) */
  function normal(random) {
    return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  }

  /* A lognormal draw inside [min, max]. Out-of-range draws are drawn again rather than
     clamped, so no value piles up on a bound and the cloud has no hard edge. */
  function lognormal(random, { median, spread, min, max }) {
    for (;;) {
      const v = median * Math.exp(spread * normal(random));
      if (v >= min && v <= max) return v;
    }
  }

  function buildBook(seed = SEED, count = ACCOUNTS) {
    const random = seededRandom(seed);
    const book = [{ premium: FOCUS_PREMIUM, loss: Math.round(FOCUS_PREMIUM * FOCUS_LOSS_RATIO), focus: true }];
    for (let i = 1; i < count; i++) {
      const premium = Math.round(lognormal(random, PREMIUM));
      const hit = random() >= LOSS_FREE_SHARE;
      const loss = hit ? Math.round(premium * lognormal(random, LOSS_RATIO)) : 0;
      book.push({ premium, loss, focus: false });
    }
    return book;
  }

  function lossRatio(accounts) {
    const premium = accounts.reduce((sum, a) => sum + a.premium, 0);
    const loss = accounts.reduce((sum, a) => sum + a.loss, 0);
    return premium ? loss / premium : 0;
  }

  function percent(ratio) {
    return `${Math.round(ratio * 100)}%`;
  }

  const api = { seededRandom, normal, lognormal, buildBook, lossRatio, percent, PREMIUM, LOSS_RATIO };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.arquBookData = api;
})();
