/* ══ HAND MARKS — underlines on words in the copy ═════════════════════════════
   Each mark is its own small svg inside the element that holds its words, and is
   positioned against that element. A reveal transform, a flow opening above it
   or a column reflowing then carries the mark along with the words, where a
   page-level overlay kept drawing it where the words used to be. Words are found
   with a Range on the phrase, so nothing is added inside an element the edit
   layer owns; if the copy is edited and the phrase is gone, the mark goes too. */
(function () {
  var H = window.arquHand;
  if (!H) return;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MARKS = [{ sel: '#close-title + p', text: 'A broker', seed: 31, wait: 700 }];

  /* one rect per line the phrase sits on */
  function phraseRects(el, text) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
      n = walk.nextNode();
    while (n && n.nodeValue.indexOf(text) < 0) n = walk.nextNode();
    if (!n) return [];
    var at = n.nodeValue.indexOf(text),
      range = document.createRange();
    range.setStart(n, at);
    range.setEnd(n, at + text.length);
    return Array.prototype.filter.call(range.getClientRects(), function (r) {
      return r.width > 1;
    });
  }

  /* one pen stroke, not a sketch: a single pass that dips and lifts off at the end */
  function underline(rc, b, m) {
    var y = b.y + b.h;
    return rc.curve(
      [
        [b.x - 5, y + 3],
        [b.x + b.w * 0.5, y + 5],
        [b.x + b.w + 8, y + 1],
      ],
      H.opts(m.seed, { strokeWidth: 2, roughness: 0.4, bowing: 0.3, disableMultiStroke: true }),
    );
  }

  function svgFor(m, host) {
    if (m.svg && m.svg.parentNode === host) return m.svg;
    m.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    m.svg.setAttribute('class', 'hand-mark');
    m.svg.setAttribute('aria-hidden', 'true');
    host.classList.add('hand-host');
    host.appendChild(m.svg);
    return m.svg;
  }

  /* where the phrase sits inside its host, and a key that changes only when that does */
  function measure(m) {
    var el = document.querySelector(m.sel);
    var rects = el ? phraseRects(el, m.text) : [];
    if (!rects.length) return null;
    var host = el.parentElement,
      box = host.getBoundingClientRect();
    var boxes = rects.map(function (r) {
      return { x: r.left - box.left - host.clientLeft, y: r.top - box.top - host.clientTop, w: r.width, h: r.height };
    });
    var key = boxes
      .map(function (b) {
        return [b.x, b.y, b.w, b.h].map(Math.round).join(',');
      })
      .join(';');
    return { host: host, boxes: boxes, key: key };
  }

  /* delay < 0 draws the mark in place without inking it on */
  function drawMark(m, delay) {
    var at = measure(m);
    if (!at) {
      if (m.svg) m.svg.textContent = '';
      return false;
    }
    var svg = svgFor(m, at.host);
    if (svg.firstChild && m.key === at.key) return true;
    var rc = rough.svg(svg);
    m.key = at.key;
    svg.textContent = '';
    at.boxes.forEach(function (b) {
      var g = underline(rc, b, m);
      svg.appendChild(g);
      if (delay >= 0) H.ink(g, delay, 0.55);
    });
    return true;
  }

  /* a mark whose words went away and came back (a flow closed and reopened) inks on again */
  function redraw() {
    MARKS.forEach(function (m) {
      if (m.seen) drawMark(m, m.svg && !m.svg.firstChild ? m.wait : -1);
    });
  }

  function inkWhenSeen() {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var m = en.target.__mark;
          io.unobserve(en.target);
          setTimeout(function () {
            if (drawMark(m, 0)) m.seen = true;
            else io.observe(en.target);
          }, m.wait);
        });
      },
      { rootMargin: '0px 0px -15% 0px', threshold: 0.5 },
    );
    MARKS.forEach(function (m) {
      var el = document.querySelector(m.sel);
      if (!el) return;
      el.__mark = m;
      io.observe(el);
    });
  }

  if ('IntersectionObserver' in window && !RM) inkWhenSeen();
  else {
    MARKS.forEach(function (m) {
      m.seen = true;
    });
    redraw();
  }

  /* the words move inside their host when it rewraps, a font swaps in, or the copy is edited */
  function watchHosts() {
    var ro = new ResizeObserver(redraw);
    MARKS.forEach(function (m) {
      var el = document.querySelector(m.sel);
      if (el) ro.observe(el.parentElement);
    });
  }
  if ('ResizeObserver' in window) watchHosts();
  window.addEventListener('resize', redraw);
  document.addEventListener('input', redraw);
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', redraw);
    document.fonts.ready.then(redraw);
  }
})();
