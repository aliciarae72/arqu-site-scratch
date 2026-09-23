/* ══ HAND LAYER — the pen every hand-drawn element on the page shares ═════════
   Strokes come from rough.js 4.6.6 (MIT, jsdelivr, byte-identical to the copy
   the vellum route vendors), which re-renders real geometry with jitter and a double pass.
   Each path is drawn on with stroke-dashoffset, one after another, the way a
   person makes marks. The marks on words live in home-hand-marks.js. */
(function () {
  if (!window.rough) return;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INK = '#221f20',
    PURPLE = '#5e54c8';

  function opts(seed, over) {
    var o = { stroke: PURPLE, strokeWidth: 1.6, roughness: 1.6, bowing: 1.6, seed: seed };
    for (var k in over) o[k] = over[k];
    return o;
  }

  /* draw every path in node on, in order; returns when the last one finishes */
  function ink(node, delay, speed) {
    var paths = (node.tagName === 'path' ? [node] : Array.prototype.slice.call(node.querySelectorAll('path'))).filter(
      function (p) {
        return p.getAttribute('stroke') !== 'none';
      },
    );
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

  /* ── the hero: a person holding up their ask, in front of what we bring ── */
  function heroMotif() {
    var svg = document.querySelector('.hand-motif');
    if (!svg) return;
    var rc = rough.svg(svg);
    var ask = rc.ellipse(136, 251, 156, 150, opts(3, { stroke: INK, strokeWidth: 1.5, roughness: 1.5 }));
    var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    var a = { stroke: INK, strokeWidth: 1.3, roughness: 1, bowing: 1 };
    arrow.appendChild(
      rc.curve(
        [
          [182, 350],
          [174, 337],
          [158, 330],
        ],
        opts(40, a),
      ),
    );
    arrow.appendChild(
      rc.linearPath(
        [
          [166, 324],
          [157, 330],
          [167, 336],
        ],
        opts(41, a),
      ),
    );
    svg.appendChild(ask);
    svg.appendChild(arrow);
    ink(ask, 750, 0.6);
    ink(arrow, 2050, 0.4);
  }
  heroMotif();

  /* the hero leans a few pixels toward the pointer: big circle one way, the ask the other */
  var hero = document.querySelector('.hero'),
    motif = document.querySelector('.motif');
  if (hero && motif && !RM) {
    hero.addEventListener(
      'pointermove',
      function (e) {
        var r = hero.getBoundingClientRect();
        motif.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        motif.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      },
      { passive: true },
    );
    hero.addEventListener('pointerleave', function () {
      motif.style.setProperty('--px', 0);
      motif.style.setProperty('--py', 0);
    });
  }

  /* the card wash follows the pointer, and so does the same wash wherever [data-wash] carries it */
  Array.prototype.forEach.call(document.querySelectorAll('.way, [data-wash]'), function (card) {
    card.addEventListener(
      'pointermove',
      function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      },
      { passive: true },
    );
  });
})();
