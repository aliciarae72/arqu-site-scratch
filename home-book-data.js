/* The Programs hero's sample book: seeded, so it is the same book on every load.
   The first account is the focus, the book's single worst loss. */
(() => {
  const ACCOUNTS = 240;
  const SEED = 20260924;
  const FOCUS_LOSS_RATIO = 0.87;
  const FOCUS_PREMIUM = 1200000;
  const LOSS_FREE_SHARE = 0.3;

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

  function buildBook(seed = SEED, count = ACCOUNTS) {
    const random = seededRandom(seed);
    const book = [{ premium: FOCUS_PREMIUM, loss: Math.round(FOCUS_PREMIUM * FOCUS_LOSS_RATIO), focus: true }];
    for (let i = 1; i < count; i++) {
      const premium = Math.round(40000 * Math.exp(random() * 2.3));
      const hit = random() >= LOSS_FREE_SHARE;
      const loss = hit ? Math.round(premium * random() * 0.75) : 0;
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

  const api = { seededRandom, buildBook, lossRatio, percent };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.arquBookData = api;
})();
