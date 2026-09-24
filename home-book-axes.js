/* The Programs hero's chart geometry: premium on a log x axis, loss ratio on a
   linear y axis, and the tick labels for whatever part of it is in frame. Plot
   units run 0 to 1000 across and 0 to 800 down, whatever the screen size. */
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PREMIUM_MIN = 30000;
  const PREMIUM_MAX = 1600000;
  const PLOT_W = 1000;
  const PLOT_H = 800;
  const LOG_SPAN = Math.log(PREMIUM_MAX / PREMIUM_MIN);
  const MAX_TICKS = 5;
  const LABEL_INSET = 16;

  const plotX = (premium) => (Math.log(premium / PREMIUM_MIN) / LOG_SPAN) * PLOT_W;
  const premiumAt = (x) => PREMIUM_MIN * Math.exp((x / PLOT_W) * LOG_SPAN);
  const plotY = (ratio) => PLOT_H * (1 - ratio);
  const ratioAt = (y) => 1 - y / PLOT_H;

  /* the smallest 1, 2, 2.5 or 5 step that splits `span` into at most MAX_TICKS - 1 gaps */
  function niceStep(span) {
    const raw = span / (MAX_TICKS - 1);
    const decade = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((k) => k * decade).find((step) => step >= raw);
  }

  function linearTicks(lo, hi) {
    const step = niceStep(hi - lo);
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
    return ticks;
  }

  /* Wide ranges tick at 1, 2 and 5 of each decade, the way a log axis reads; a
     narrow range ticks evenly, so a close zoom still has labels. */
  function premiumTicks(lo, hi) {
    if (hi / lo <= 4) return linearTicks(lo, hi);
    const ticks = [];
    for (let e = 3; e <= 7; e++) for (const k of [1, 2, 5]) ticks.push(k * 10 ** e);
    return ticks.filter((v) => v >= lo && v <= hi);
  }

  function ratioTicks(lo, hi) {
    return linearTicks(Math.max(0, lo), Math.min(1, hi));
  }

  function money(v) {
    if (v >= 1e6) return `$${Number((v / 1e6).toFixed(2))}M`;
    return `$${Number((v / 1e3).toFixed(1))}k`;
  }

  function edges(frame) {
    return { left: frame.cx - frame.width / 2, top: frame.cy - frame.height / 2 };
  }

  /* where plot point (x, y) lands on screen when `frame` fills `rect` */
  function toScreen(frame, rect, x, y) {
    const { left, top } = edges(frame);
    return { sx: rect.x + ((x - left) / frame.width) * rect.w, sy: rect.y + ((y - top) / frame.height) * rect.h };
  }

  function svgElement(doc, name, attrs, text) {
    const el = doc.createElementNS(SVG_NS, name);
    for (const key of Object.keys(attrs)) el.setAttribute(key, attrs[key]);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function xTickNodes(doc, frame, rect) {
    const { left } = edges(frame);
    const base = rect.y + rect.h;
    return premiumTicks(premiumAt(left), premiumAt(left + frame.width)).flatMap((v) => {
      const { sx } = toScreen(frame, rect, plotX(v), 0);
      // a label centred this close to either end would hang past the plot
      if (sx < rect.x + LABEL_INSET || sx > rect.x + rect.w - LABEL_INSET) return [];
      return [
        svgElement(doc, 'line', { class: 'bz-tick', x1: sx, x2: sx, y1: base, y2: base + 5 }),
        svgElement(doc, 'text', { class: 'bz-label', x: sx, y: base + 18, 'text-anchor': 'middle' }, money(v)),
      ];
    });
  }

  function yTickNodes(doc, frame, rect) {
    const { top } = edges(frame);
    return ratioTicks(ratioAt(top + frame.height), ratioAt(top)).flatMap((v) => {
      const { sy } = toScreen(frame, rect, 0, plotY(v));
      return [
        svgElement(doc, 'line', { class: 'bz-grid', x1: rect.x, x2: rect.x + rect.w, y1: sy, y2: sy }),
        svgElement(
          doc,
          'text',
          { class: 'bz-label', x: rect.x - 8, y: sy + 3, 'text-anchor': 'end' },
          `${Math.round(v * 100)}%`,
        ),
      ];
    });
  }

  /* Redraws the axes, their ticks and the whole-book reference for the frame in view. */
  function drawAxes(doc, layer, frame, rect, bookRatio) {
    const base = rect.y + rect.h;
    const avg = toScreen(frame, rect, 0, plotY(bookRatio)).sy;
    const nodes = [...yTickNodes(doc, frame, rect), ...xTickNodes(doc, frame, rect)];
    nodes.push(
      svgElement(doc, 'line', { class: 'bz-axis', x1: rect.x, x2: rect.x + rect.w, y1: base, y2: base }),
      svgElement(doc, 'line', { class: 'bz-axis', x1: rect.x, x2: rect.x, y1: rect.y, y2: base }),
      svgElement(
        doc,
        'text',
        { class: 'bz-title', x: rect.x + rect.w, y: base + 34, 'text-anchor': 'end' },
        'Premium →',
      ),
      svgElement(doc, 'text', { class: 'bz-title', x: rect.x, y: rect.y - 12, 'text-anchor': 'start' }, '↑ Loss ratio'),
    );
    if (avg >= rect.y && avg <= base) {
      nodes.push(
        svgElement(doc, 'line', { class: 'bz-avg', x1: rect.x, x2: rect.x + rect.w, y1: avg, y2: avg }),
        svgElement(
          doc,
          'text',
          { class: 'bz-avg-label', x: rect.x + rect.w, y: avg - 6, 'text-anchor': 'end' },
          `Whole book ${Math.round(bookRatio * 100)}%`,
        ),
      );
    }
    layer.replaceChildren(...nodes);
  }

  const api = { PLOT_W, PLOT_H, plotX, plotY, premiumTicks, ratioTicks, money, toScreen, svgElement, drawAxes };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.arquBookAxes = api;
})();
