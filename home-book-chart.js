/* The Programs chart: a sample book as a scatter, premium across and loss ratio up,
   each dot's area drawn to its incurred loss. The worst account is labelled, and a
   dashed line marks the loss ratio of the whole book. */
(() => {
  const node = typeof module === 'object' && module.exports;
  const data = node ? require('./home-book-data.js') : window.arquBookData;
  const axes = node ? require('./home-book-axes.js') : window.arquBookAxes;
  const { lossRatio, percent } = data;
  /* radius in plot units per root dollar of loss, so area tracks dollars */
  const RADIUS_PER_ROOT_DOLLAR = 0.042;
  const LOSS_FREE_RADIUS = 3;
  /* room around the plot box, in plot units, so an edge dot is never cut in half */
  const PAD = 24;
  const FALLBACK_SIZE = { width: 500, height: 400 };
  /* room around the plot for the tick labels and axis titles, in screen pixels */
  const MARGIN = { left: 50, right: 14, top: 28, bottom: 44 };

  /* Loss-free accounts all sit at 0%, so they spread over a thin seeded band around it
     instead of stacking into one line. The key says the band is jittered. */
  const ZERO_JITTER = 24;
  const jitterOf = (index) => (data.seededRandom(9001 + index)() - 0.5) * ZERO_JITTER;

  function radiusOf(account) {
    return account.loss ? Math.sqrt(account.loss) * RADIUS_PER_ROOT_DOLLAR : LOSS_FREE_RADIUS;
  }

  /* one dot per account, by premium and loss ratio; largest drawn first so no small dot hides, the focus last */
  function placeDots(book) {
    const dots = book.map((account, index) => ({
      account,
      index,
      x: axes.plotX(account.premium),
      y: axes.plotY(account.loss / account.premium) + (account.loss ? 0 : jitterOf(index)),
      r: radiusOf(account),
    }));
    return dots.sort((a, b) => Number(a.account.focus) - Number(b.account.focus) || b.r - a.r || a.index - b.index);
  }

  /* the frame at this aspect that holds the whole plot box, 0% to 100% and every premium */
  function chartFrame(aspect) {
    const boxW = axes.PLOT_W + 2 * PAD;
    const boxH = axes.PLOT_H + 2 * PAD;
    const height = Math.max(boxH, boxW / aspect);
    return { cx: axes.PLOT_W / 2, cy: axes.PLOT_H / 2, width: height * aspect, height };
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

  function viewBox(frame) {
    const x = frame.cx - frame.width / 2;
    const y = frame.cy - frame.height / 2;
    return [x, y, frame.width, frame.height].map((v) => v.toFixed(2)).join(' ');
  }

  function scene(book = data.buildBook()) {
    const dots = placeDots(book);
    return { book, dots, focus: dots.find((d) => d.account.focus), bookRatio: lossRatio(book) };
  }

  function describe(sc) {
    return (
      `Scatter chart of a sample book of ${sc.book.length} accounts: premium across, loss ratio up, ` +
      `each dot sized to its incurred loss. The worst account's loss ratio is ${percent(lossRatio([sc.focus.account]))}; ` +
      `the whole book's is ${percent(sc.bookRatio)}.`
    );
  }

  function drawDots(doc, plot, dots) {
    for (const d of dots) {
      const kind = d.account.focus ? 'bz-dot bz-focus' : d.account.loss ? 'bz-dot' : 'bz-dot bz-clean';
      plot.appendChild(
        axes.svgElement(doc, 'circle', { class: kind, cx: d.x.toFixed(2), cy: d.y.toFixed(2), r: d.r.toFixed(2) }),
      );
    }
  }

  /* the worst account's label, set to the left of its dot with a short leader */
  function focusLabel(doc, frame, rect, focus) {
    const { sx, sy } = axes.toScreen(frame, rect, focus.x, focus.y);
    const edge = sx - (focus.r / frame.width) * rect.w;
    const text = `One account · ${percent(lossRatio([focus.account]))}`;
    return [
      axes.svgElement(doc, 'line', { class: 'bz-leader', x1: edge - 4, x2: edge - 18, y1: sy, y2: sy }),
      axes.svgElement(doc, 'text', { class: 'bz-focus-label', x: edge - 22, y: sy + 3, 'text-anchor': 'end' }, text),
    ];
  }

  function sizeOf(svg) {
    const box = svg.getBoundingClientRect ? svg.getBoundingClientRect() : FALLBACK_SIZE;
    return box.width && box.height ? { width: box.width, height: box.height } : FALLBACK_SIZE;
  }

  /* Builds the chart inside the figure's svg; returns a painter that fits it to the svg's size. */
  function chart(doc, fig, sc) {
    const svg = fig.querySelector('[data-bz-svg]');
    const layer = svg.appendChild(axes.svgElement(doc, 'g', { class: 'bz-axes' }));
    const plot = svg.appendChild(axes.svgElement(doc, 'svg', { class: 'bz-plot', preserveAspectRatio: 'none' }));
    drawDots(doc, plot, sc.dots);
    return () => {
      const size = sizeOf(svg);
      const rect = plotRect(size);
      const frame = chartFrame(rect.w / rect.h);
      svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
      for (const [k, v] of Object.entries({ x: rect.x, y: rect.y, width: rect.w, height: rect.h }))
        plot.setAttribute(k, v);
      plot.setAttribute('viewBox', viewBox(frame));
      axes.drawAxes(doc, layer, frame, rect, sc.bookRatio);
      for (const label of focusLabel(doc, frame, rect, sc.focus)) layer.appendChild(label);
    };
  }

  function mount(doc, win) {
    const fig = doc.querySelector('[data-book-chart]');
    if (!fig) throw new Error('home-book-chart: [data-book-chart] is missing from the page');
    const sc = scene();
    fig.querySelector('[data-bz-stage]').setAttribute('aria-label', describe(sc));
    fig.querySelector('[data-bz-ratio]').textContent = percent(sc.bookRatio);
    fig.querySelector('[data-bz-count]').textContent = `${sc.book.length} accounts`;
    const paint = chart(doc, fig, sc);
    paint();
    win.addEventListener('resize', paint);
  }

  const api = { placeDots, chartFrame, plotRect, viewBox, scene, describe, mount };
  if (node) module.exports = api;
  else api.mount(document, window);
})();
