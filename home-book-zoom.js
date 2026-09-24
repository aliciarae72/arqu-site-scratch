/* The Programs hero: a sample book as a dot chart, one dot per account, each dot's
   area drawn to its incurred loss. The camera opens on the worst loss and pulls
   back to the whole book, and the readout is the loss ratio of what is in frame. */
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ACCOUNTS = 240;
  const SEED = 20260924;
  const FOCUS_LOSS_RATIO = 0.87;
  const FOCUS_PREMIUM = 1200000;
  const LOSS_FREE_SHARE = 0.3;
  /* one unit of radius per this many dollars of loss, square-rooted so area tracks dollars */
  const RADIUS_PER_ROOT_DOLLAR = 0.04;
  const LOSS_FREE_RADIUS = 2.2;
  const GAP = 1.6;
  const SPIRAL_PITCH = 1.2;
  const ASPECT = 1.25;
  const HOLD_MS = 1400;
  const ZOOM_MS = 3800;

  /* mulberry32: a seeded generator, so the sample book is the same on every load */
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

  /* The first account is the focus: the book's single worst loss. */
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

  function radiusOf(account) {
    return account.loss ? Math.sqrt(account.loss) * RADIUS_PER_ROOT_DOLLAR : LOSS_FREE_RADIUS;
  }

  /* Largest first, each dot at the next point along a spiral out from the centre where
     it touches nothing already placed. The search never turns back, so no small dot
     tucks in beside the worst loss, and every step out takes in smaller losses. */
  function packDots(book) {
    const order = book.map((account, index) => ({ account, index, r: radiusOf(account) }));
    order.sort((a, b) => b.r - a.r || a.index - b.index);
    const placed = [];
    let angle = 0;
    for (const dot of order) {
      for (;;) {
        const distance = angle * SPIRAL_PITCH;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + dot.r + GAP)) {
          placed.push({ ...dot, x, y });
          break;
        }
        angle += 0.6 / Math.max(distance, 4);
      }
    }
    return placed;
  }

  /* the frame at ASPECT that holds a set of dots, with a margin */
  function frameAround(dots, margin) {
    const left = Math.min(...dots.map((d) => d.x - d.r));
    const right = Math.max(...dots.map((d) => d.x + d.r));
    const top = Math.min(...dots.map((d) => d.y - d.r));
    const bottom = Math.max(...dots.map((d) => d.y + d.r));
    const height = Math.max(bottom - top, (right - left) / ASPECT) * margin;
    return { cx: (left + right) / 2, cy: (top + bottom) / 2, width: height * ASPECT, height };
  }

  /* Centre moves linearly, size geometrically, so each moment of the pull-back feels the same speed. */
  function frameAt(progress, from, to) {
    const scale = (to.height / from.height) ** progress;
    const height = from.height * scale;
    return {
      cx: from.cx + (to.cx - from.cx) * progress,
      cy: from.cy + (to.cy - from.cy) * progress,
      width: height * ASPECT,
      height,
    };
  }

  function inFrame(dots, frame) {
    const halfW = frame.width / 2;
    const halfH = frame.height / 2;
    return dots.filter(
      (d) => Math.abs(d.x - frame.cx) + d.r <= halfW + 1e-9 && Math.abs(d.y - frame.cy) + d.r <= halfH + 1e-9,
    );
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  /* where the camera is at `elapsed` ms after the play starts: held, then pulling back */
  function progressAt(elapsed) {
    return easeInOut(Math.min(1, Math.max(0, (elapsed - HOLD_MS) / ZOOM_MS)));
  }

  function percent(ratio) {
    return `${Math.round(ratio * 100)}%`;
  }

  function readout(visible, total) {
    const n = visible.length;
    const who = n === total ? `Whole book · ${n} accounts` : n === 1 ? 'One account' : `${n} accounts in view`;
    return { who, ratio: percent(lossRatio(visible.map((d) => d.account))) };
  }

  function svgElement(doc, name, attrs) {
    const el = doc.createElementNS(SVG_NS, name);
    for (const key of Object.keys(attrs)) el.setAttribute(key, attrs[key]);
    return el;
  }

  function drawDots(doc, svg, dots) {
    for (const d of dots) {
      const kind = d.account.focus ? 'bz-dot bz-focus' : d.account.loss ? 'bz-dot' : 'bz-dot bz-clean';
      svg.appendChild(
        svgElement(doc, 'circle', { class: kind, cx: d.x.toFixed(2), cy: d.y.toFixed(2), r: d.r.toFixed(2) }),
      );
    }
  }

  function viewBox(frame) {
    const x = frame.cx - frame.width / 2;
    const y = frame.cy - frame.height / 2;
    return [x, y, frame.width, frame.height].map((v) => v.toFixed(2)).join(' ');
  }

  function scene(book = buildBook()) {
    const dots = packDots(book);
    const focus = dots.find((d) => d.account.focus);
    return { book, dots, start: frameAround([focus], 1.08), end: frameAround(dots, 1.04) };
  }

  function describe(sc) {
    const focus = sc.book.find((a) => a.focus);
    return (
      `Sample book of ${sc.book.length} accounts, one dot per account, each dot sized to its incurred loss. ` +
      `The worst account's loss ratio is ${percent(lossRatio([focus]))}; the whole book's is ${percent(lossRatio(sc.book))}.`
    );
  }

  const NOTES = {
    one: 'One account. One awful loss.',
    zoom: 'Now the rest of the book…',
    book: 'The rest of the book carries it.',
  };

  function phaseOf(progress) {
    return progress >= 1 ? 'book' : progress > 0 ? 'zoom' : 'one';
  }

  function onceHalfSeen(win, el, run) {
    const watch = new win.IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        watch.disconnect();
        run();
      },
      { threshold: 0.5 },
    );
    watch.observe(el);
  }

  /* Plays once when the figure first comes into view; Replay runs it again. */
  function mount(doc, win) {
    const fig = doc.querySelector('[data-book-zoom]');
    if (!fig) throw new Error('home-book-zoom: [data-book-zoom] is missing from the page');
    const svg = fig.querySelector('[data-bz-svg]');
    const ratio = fig.querySelector('[data-bz-ratio]');
    const who = fig.querySelector('[data-bz-who]');
    const note = fig.querySelector('[data-bz-note]');
    const replay = fig.querySelector('[data-bz-replay]');
    const sc = scene();
    drawDots(doc, svg, sc.dots);
    fig.querySelector('[data-bz-stage]').setAttribute('aria-label', describe(sc));

    function show(progress) {
      const frame = frameAt(progress, sc.start, sc.end);
      svg.setAttribute('viewBox', viewBox(frame));
      const read = readout(inFrame(sc.dots, frame), sc.book.length);
      ratio.textContent = read.ratio;
      who.textContent = read.who;
      const phase = phaseOf(progress);
      fig.setAttribute('data-phase', phase);
      note.textContent = NOTES[phase];
    }

    let run = 0;
    function play() {
      const id = ++run;
      const began = win.performance.now();
      const tick = (now) => {
        if (id !== run) return;
        const progress = progressAt(now - began);
        show(progress);
        if (progress < 1) win.requestAnimationFrame(tick);
      };
      win.requestAnimationFrame(tick);
    }

    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show(1);
      replay.hidden = true;
      return;
    }
    show(0);
    replay.addEventListener('click', play);
    onceHalfSeen(win, fig, play);
  }

  const api = {
    buildBook,
    lossRatio,
    packDots,
    frameAround,
    frameAt,
    inFrame,
    progressAt,
    readout,
    scene,
    describe,
    drawDots,
    viewBox,
    mount,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.mount(document, window);
})();
