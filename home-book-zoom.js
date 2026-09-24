/* The Programs hero: a sample book as an x/y dot chart, premium across and loss
   ratio up, each dot's area drawn to its incurred loss. The camera opens on the
   worst loss and pulls back to the whole book; the readout is the loss ratio of
   what is in frame, and the axes relabel for whatever the camera shows. */
(() => {
  const node = typeof module === 'object' && module.exports;
  const data = node ? require('./home-book-data.js') : window.arquBookData;
  const axes = node ? require('./home-book-axes.js') : window.arquBookAxes;
  const { lossRatio, percent } = data;
  /* radius in plot units per root dollar of loss, so area tracks dollars */
  const RADIUS_PER_ROOT_DOLLAR = 0.042;
  const LOSS_FREE_RADIUS = 3;
  const HOLD_MS = 1400;
  const ZOOM_MS = 3800;
  const FALLBACK_SIZE = { width: 500, height: 400 };
  /* room around the plot for the tick labels and axis titles, in screen pixels */
  const MARGIN = { left: 50, right: 14, top: 28, bottom: 44 };

  function radiusOf(account) {
    return account.loss ? Math.sqrt(account.loss) * RADIUS_PER_ROOT_DOLLAR : LOSS_FREE_RADIUS;
  }

  /* one dot per account, by premium and loss ratio; largest drawn first so no small dot hides, the focus last */
  function placeDots(book) {
    const dots = book.map((account, index) => ({
      account,
      index,
      x: axes.plotX(account.premium),
      y: axes.plotY(account.loss / account.premium),
      r: radiusOf(account),
    }));
    return dots.sort((a, b) => Number(a.account.focus) - Number(b.account.focus) || b.r - a.r || a.index - b.index);
  }

  /* the frame of this aspect that holds a set of dots, with a margin */
  function frameAround(dots, margin, aspect) {
    const left = Math.min(...dots.map((d) => d.x - d.r));
    const right = Math.max(...dots.map((d) => d.x + d.r));
    const top = Math.min(...dots.map((d) => d.y - d.r));
    const bottom = Math.max(...dots.map((d) => d.y + d.r));
    const height = Math.max(bottom - top, (right - left) / aspect) * margin;
    return { cx: (left + right) / 2, cy: (top + bottom) / 2, width: height * aspect, height };
  }

  /* Size changes geometrically, so each moment of the pull-back feels the same speed. The
     anchor (the focus dot) glides linearly from its place in `from` to its place in `to`,
     measured as a share of the frame, so it never leaves the frame on the way out. */
  function frameAt(progress, from, to, anchor) {
    const height = from.height * (to.height / from.height) ** progress;
    const width = (height * from.width) / from.height;
    const share = (frame, axis, size) => (anchor[axis] - frame[`c${axis}`]) / frame[size];
    const sx = share(from, 'x', 'width') + (share(to, 'x', 'width') - share(from, 'x', 'width')) * progress;
    const sy = share(from, 'y', 'height') + (share(to, 'y', 'height') - share(from, 'y', 'height')) * progress;
    return { cx: anchor.x - sx * width, cy: anchor.y - sy * height, width, height };
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

  function readout(visible, total) {
    const n = visible.length;
    const who = n === total ? `Whole book · ${n} accounts` : n === 1 ? 'One account' : `${n} accounts in view`;
    return { who, ratio: percent(lossRatio(visible.map((d) => d.account))) };
  }

  function drawDots(doc, plot, dots) {
    for (const d of dots) {
      const kind = d.account.focus ? 'bz-dot bz-focus' : d.account.loss ? 'bz-dot' : 'bz-dot bz-clean';
      plot.appendChild(
        axes.svgElement(doc, 'circle', { class: kind, cx: d.x.toFixed(2), cy: d.y.toFixed(2), r: d.r.toFixed(2) }),
      );
    }
  }

  function viewBox(frame) {
    const x = frame.cx - frame.width / 2;
    const y = frame.cy - frame.height / 2;
    return [x, y, frame.width, frame.height].map((v) => v.toFixed(2)).join(' ');
  }

  /* the plot's box inside the figure's svg, leaving MARGIN for the axes */
  function plotRect(size) {
    return {
      x: MARGIN.left,
      y: MARGIN.top,
      w: size.width - MARGIN.left - MARGIN.right,
      h: size.height - MARGIN.top - MARGIN.bottom,
    };
  }

  /* Start and end frames depend on the plot's aspect, so they are made per screen shape. */
  function scene(book = data.buildBook()) {
    const dots = placeDots(book);
    const focus = dots.find((d) => d.account.focus);
    const frames = new Map();
    const framesFor = (aspect) => {
      const key = aspect.toFixed(3);
      if (!frames.has(key)) {
        frames.set(key, { start: frameAround([focus], 1.5, aspect), end: frameAround(dots, 1.06, aspect) });
      }
      return frames.get(key);
    };
    return { book, dots, focus, framesFor, bookRatio: lossRatio(book) };
  }

  function describe(sc) {
    const focus = sc.book.find((a) => a.focus);
    return (
      `Sample book of ${sc.book.length} accounts, plotted by premium and loss ratio, each dot sized to its incurred loss. ` +
      `The worst account's loss ratio is ${percent(lossRatio([focus]))}; the whole book's is ${percent(sc.bookRatio)}.`
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

  function sizeOf(svg) {
    const box = svg.getBoundingClientRect ? svg.getBoundingClientRect() : FALLBACK_SIZE;
    return box.width && box.height ? { width: box.width, height: box.height } : FALLBACK_SIZE;
  }

  /* Builds the chart inside the figure's svg; returns a painter for any moment of the zoom. */
  function chart(doc, fig, sc) {
    const svg = fig.querySelector('[data-bz-svg]');
    const layer = svg.appendChild(axes.svgElement(doc, 'g', { class: 'bz-axes' }));
    const plot = svg.appendChild(axes.svgElement(doc, 'svg', { class: 'bz-plot', preserveAspectRatio: 'none' }));
    drawDots(doc, plot, sc.dots);
    const parts = ['ratio', 'who', 'note'].map((k) => fig.querySelector(`[data-bz-${k}]`));
    return (progress) => {
      const size = sizeOf(svg);
      const rect = plotRect(size);
      const { start, end } = sc.framesFor(rect.w / rect.h);
      const frame = frameAt(progress, start, end, sc.focus);
      svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
      for (const [k, v] of Object.entries({ x: rect.x, y: rect.y, width: rect.w, height: rect.h }))
        plot.setAttribute(k, v);
      plot.setAttribute('viewBox', viewBox(frame));
      axes.drawAxes(doc, layer, frame, rect, sc.bookRatio);
      const read = readout(inFrame(sc.dots, frame), sc.book.length);
      const phase = phaseOf(progress);
      [parts[0].textContent, parts[1].textContent, parts[2].textContent] = [read.ratio, read.who, NOTES[phase]];
      fig.setAttribute('data-phase', phase);
    };
  }

  /* Plays once when the figure first comes into view; Replay runs it again. */
  function mount(doc, win) {
    const fig = doc.querySelector('[data-book-zoom]');
    if (!fig) throw new Error('home-book-zoom: [data-book-zoom] is missing from the page');
    const replay = fig.querySelector('[data-bz-replay]');
    const sc = scene();
    fig.querySelector('[data-bz-stage]').setAttribute('aria-label', describe(sc));
    const show = chart(doc, fig, sc);
    let shown = 0;
    let run = 0;
    const paint = (progress) => {
      shown = progress;
      show(progress);
    };
    function play() {
      const id = ++run;
      const began = win.performance.now();
      const tick = (now) => {
        if (id !== run) return;
        const progress = progressAt(now - began);
        paint(progress);
        if (progress < 1) win.requestAnimationFrame(tick);
      };
      win.requestAnimationFrame(tick);
    }
    win.addEventListener('resize', () => show(shown));
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(1);
      replay.hidden = true;
      return;
    }
    paint(0);
    replay.addEventListener('click', play);
    onceHalfSeen(win, fig, play);
  }

  const api = {
    placeDots,
    frameAround,
    frameAt,
    inFrame,
    progressAt,
    readout,
    plotRect,
    scene,
    describe,
    viewBox,
    mount,
  };
  if (node) module.exports = api;
  else api.mount(document, window);
})();
