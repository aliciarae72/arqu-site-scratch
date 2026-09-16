/* ══ HAND LAYER — the human marks, inked in as they come into view ═══════════
   Strokes come from rough.js 4.6.6 (MIT, jsdelivr, byte-identical to the copy
   the vellum route vendors), which re-renders real geometry with jitter and a double pass.
   Each path is drawn on with stroke-dashoffset, one after another, the way a
   person makes marks. Text marks are measured with a Range on the phrase, so no
   markup is added inside anything the edit layer owns; if the copy is edited
   and the phrase is gone, that mark simply doesn't draw. */
(function () {
  if (!window.rough) return;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INK = '#221f20', PURPLE = '#5e54c8';

  function opts(seed, over) {
    var o = { stroke: PURPLE, strokeWidth: 1.6, roughness: 1.6, bowing: 1.6, seed: seed };
    for (var k in over) o[k] = over[k];
    return o;
  }

  /* draw every path in node on, in order; returns when the last one finishes */
  function ink(node, delay, speed) {
    var paths = (node.tagName === 'path' ? [node] : Array.prototype.slice.call(node.querySelectorAll('path')))
      .filter(function (p) { return p.getAttribute('stroke') !== 'none'; });
    var t = delay || 0;
    paths.forEach(function (p) {
      var L = p.getTotalLength();
      if (RM || !L) return;
      var dur = Math.max(160, L / (speed || 0.7));
      p.style.strokeDasharray = L + ' ' + L;
      p.style.strokeDashoffset = L;
      p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.5,.1,.3,1) ' + t + 'ms';
      p.style.strokeDashoffset = '0';
      t += dur * 0.6;
    });
    return t;
  }
  window.arquHand = { ink: ink, opts: opts, INK: INK, PURPLE: PURPLE };

  /* ── page marks ─────────────────────────────────────────────────────────── */
  var layer = document.getElementById('hand');
  var MARKS = [
    { sel: '.val:nth-child(2) h3', text: 'Human touch', kind: 'underline', seed: 27, wait: 800 },
    { sel: '.way-grid .or', text: 'or', kind: 'circle', seed: 5, wait: 700, ink: true },
    { sel: '[data-rn] .rn-head h3', text: '93 seconds', kind: 'underline', seed: 12, wait: 1300 },
    { sel: '#close-title + p', text: 'A broker', kind: 'underline', seed: 31, wait: 700, calm: true }
  ];

  function phraseRect(el, text) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = walk.nextNode())) {
      var i = n.nodeValue.indexOf(text);
      if (i < 0) continue;
      var r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + text.length);
      var rect = r.getClientRects()[0];
      return rect && rect.width ? rect : null;
    }
    return null;
  }

  function shape(rc, m, b) {
    var o = opts(m.seed, m.ink ? { stroke: INK, strokeWidth: 1.3 } : {});
    if (m.kind === 'circle') {
      var big = b.h > 46;
      o.roughness = 1.9; o.bowing = 2.1; o.strokeWidth = big ? 2 : o.strokeWidth;
      return rc.ellipse(b.x + b.w / 2, b.y + b.h / 2,
        b.w * (big ? 1.08 : 1.3) + (big ? 18 : 22), b.h * (big ? 1.0 : 1.35) + 8, o);
    }
    var y = b.y + b.h + 2;
    if (m.calm) {
      // Two points and almost no bowing: still drawn by hand, but it reads as
      // an underline rather than a scribble over the word.
      o.roughness = 0.6; o.bowing = 0.6;
      return rc.linearPath([[b.x - 2, y + 2], [b.x + b.w + 3, y + 1]], o);
    }
    o.roughness = 1.3; o.bowing = 2.2;
    return rc.linearPath([[b.x - 4, y + 2], [b.x + b.w * 0.4, y + 4], [b.x + b.w * 0.75, y], [b.x + b.w + 6, y + 3]], o);
  }

  function drawMark(m, animate) {
    var el = document.querySelector(m.sel);
    var r = el && phraseRect(el, m.text);
    if (m.node && m.node.parentNode) m.node.parentNode.removeChild(m.node);
    m.node = null;
    if (!r) return false;
    var b = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    m.node = shape(rough.svg(layer), m, b);
    layer.appendChild(m.node);
    if (animate) ink(m.node, 0, 0.55);
    return true;
  }

  function redraw() { MARKS.forEach(function (m) { if (m.seen) drawMark(m, false); }); }

  if ('IntersectionObserver' in window && !RM) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var m = en.target.__mark;
        io.unobserve(en.target);
        setTimeout(function () { if (drawMark(m, true)) m.seen = true; else io.observe(en.target); }, m.wait || 600);
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0.5 });
    MARKS.forEach(function (m) {
      var el = document.querySelector(m.sel);
      if (el) { el.__mark = m; io.observe(el); }
    });
  } else {
    MARKS.forEach(function (m) { m.seen = true; });
    redraw();
  }

  var queued = 0;
  function later() { clearTimeout(queued); queued = setTimeout(redraw, 120); }
  window.addEventListener('resize', later);
  window.addEventListener('arqu:layout', function () { setTimeout(redraw, 700); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);

  /* ── the hero: a person holding up their ask, in front of what we bring ── */
  function heroMotif() {
    var svg = document.querySelector('.hand-motif');
    if (!svg) return;
    var rc = rough.svg(svg);
    var ask = rc.ellipse(136, 251, 156, 150, opts(3, { stroke: INK, strokeWidth: 1.5, roughness: 1.5 }));
    var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    var a = { stroke: INK, strokeWidth: 1.3, roughness: 1, bowing: 1 };
    arrow.appendChild(rc.curve([[182, 350], [174, 337], [158, 330]], opts(40, a)));
    arrow.appendChild(rc.linearPath([[166, 324], [157, 330], [167, 336]], opts(41, a)));
    svg.appendChild(ask); svg.appendChild(arrow);
    ink(ask, 750, 0.6);
    ink(arrow, 2050, 0.4);
  }
  heroMotif();

  /* the hero leans a few pixels toward the pointer: big circle one way, the ask the other */
  var hero = document.querySelector('.hero'), motif = document.querySelector('.motif');
  if (hero && motif && !RM) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      motif.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      motif.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      motif.style.setProperty('--px', 0); motif.style.setProperty('--py', 0);
    });
  }

  /* the card wash follows the pointer */
  Array.prototype.forEach.call(document.querySelectorAll('.way'), function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });
})();
