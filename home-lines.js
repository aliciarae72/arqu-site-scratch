/* The casualty dot matrix in the #lines section. One dot is one record, and every
   column shares one pitch and one width, so the columns compare by area and the
   drop to a single dot reads true. */
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PER_ROW = 36;
  const PITCH = 10;
  const RING_RADIUS = 30;

  function dotGrid(count) {
    const rows = Math.ceil(count / PER_ROW);
    return { rows, width: PER_ROW * PITCH, height: rows * PITCH };
  }

  /* bottom-up, left to right; the part row on top is centred, so a lone dot sits under its count */
  function dotPosition(index, count, rows = dotGrid(count).rows) {
    const row = Math.floor(index / PER_ROW);
    const inRow = row === rows - 1 ? count - row * PER_ROW : PER_ROW;
    return {
      x: ((index % PER_ROW) + (PER_ROW - inRow) / 2) * PITCH + PITCH / 2,
      y: (rows - 1 - row) * PITCH + PITCH / 2,
    };
  }

  /* a zero-length segment with a round cap draws one dot, so a column is one path */
  function dotPath(count) {
    const { rows } = dotGrid(count);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const dot = dotPosition(i, count, rows);
      parts.push(`M${dot.x} ${dot.y}h0`);
    }
    return parts.join('');
  }

  function svgElement(doc, name, attrs) {
    const el = doc.createElementNS(SVG_NS, name);
    for (const key of Object.keys(attrs)) el.setAttribute(key, attrs[key]);
    return el;
  }

  function buildColumn(doc, stack) {
    const count = Number(stack.getAttribute('data-count'));
    const grid = dotGrid(count);
    const svg = svgElement(doc, 'svg', { viewBox: `0 0 ${grid.width} ${grid.height}`, 'aria-hidden': 'true' });
    svg.appendChild(svgElement(doc, 'path', { class: 'dots', d: dotPath(count) }));
    if (stack.hasAttribute('data-punchline')) {
      const last = dotPosition(count - 1, count);
      svg.appendChild(svgElement(doc, 'circle', { class: 'dots-ring', cx: last.x, cy: last.y, r: RING_RADIUS }));
    }
    stack.appendChild(svg);
    return svg;
  }

  /* The page's own reveal pass (home.html, RISE) adds .seen to .dots-chart, and
     carries the failsafe that shows every reveal when the observer never fires. */
  function mount(doc) {
    const chart = doc.querySelector('.dots-chart');
    if (!chart) throw new Error('home-lines: .dots-chart is missing from the page');
    for (const stack of chart.querySelectorAll('.dots-stack[data-count]')) buildColumn(doc, stack);
  }

  const api = { dotGrid, dotPath, buildColumn, mount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.mount(document);
})();
