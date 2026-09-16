/* ══ AMBIENT FIELD — a page-wide grid of dots, kept deliberately faint ════════
   Alicia's keyword was subtle. At rest the dots are barely there and fainter
   still over the text column. They answer three things a person does: the
   pointer (dots near it lift into purple and step aside), scrolling (the grid
   drifts at a slower rate than the page) and a click or tap (one soft ring
   travels out through the grid). It only animates while one of those is
   settling, and it does nothing at all under prefers-reduced-motion. */
(function () {
  var cv = document.querySelector('canvas.ambient');
  if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ctx = cv.getContext('2d');
  var GAP = 30, REACH = 170, w = 0, h = 0, colL = 0, colR = 0, raf = 0;
  var P = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, on: 0, von: 0 };
  var rings = [];

  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = w * dpr | 0; cv.height = h * dpr | 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var col = document.querySelector('main .wrap');
    if (col) { var r = col.getBoundingClientRect(); colL = r.left + 40; colR = r.right - 40; }
    kick();
  }

  function lift(x, y, now) {
    var dx = x - P.x, dy = y - P.y, d = Math.sqrt(dx * dx + dy * dy), f = 0, g = 0;
    if (P.von > 0.01 && d < REACH) { f = 1 - d / REACH; f = f * f * (3 - 2 * f) * P.von; }
    for (var i = 0; i < rings.length; i++) {
      var age = now - rings[i].t, rr = age * 0.42;
      var rx = x - rings[i].x, ry = y - rings[i].y, e = (Math.sqrt(rx * rx + ry * ry) - rr) / 28;
      g = Math.max(g, Math.exp(-e * e) * (1 - age / 1700));
    }
    return { f: f, g: g, dx: d ? dx / d : 0, dy: d ? dy / d : 0 };
  }

  function frame(now) {
    raf = 0;
    P.x += (P.tx - P.x) * 0.16; P.y += (P.ty - P.y) * 0.16;
    P.von += (P.on - P.von) * 0.08;
    rings = rings.filter(function (r) { return now - r.t < 1700; });
    ctx.clearRect(0, 0, w, h);
    var oy = -((window.scrollY * 0.18) % GAP), ox = (w % GAP) / 2;
    for (var y = oy; y < h + GAP; y += GAP) {
      for (var x = ox; x < w + GAP; x += GAP) {
        var L = lift(x, y, now), inCol = x > colL && x < colR;
        var push = L.f * 7, hot = Math.max(L.f, L.g);
        var a = (inCol ? 0.05 : 0.085) * (1 - hot);
        if (a > 0.004) { ctx.fillStyle = 'rgba(34,31,32,' + a.toFixed(3) + ')'; ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
        if (hot > 0.02) {
          ctx.beginPath();
          ctx.arc(x + L.dx * push, y + L.dy * push, 0.8 + hot * 1.1, 0, 6.2832);
          ctx.fillStyle = 'rgba(94,84,200,' + (hot * (inCol ? 0.2 : 0.3)).toFixed(3) + ')';
          ctx.fill();
        }
      }
    }
    var moving = Math.abs(P.tx - P.x) > 0.3 || Math.abs(P.ty - P.y) > 0.3 || Math.abs(P.on - P.von) > 0.01;
    if (moving || rings.length) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    if (P.x < -9000) { P.x = e.clientX; P.y = e.clientY; }
    P.tx = e.clientX; P.ty = e.clientY; P.on = 1; kick();
  }, { passive: true });
  document.addEventListener('pointerleave', function () { P.on = 0; kick(); });
  window.addEventListener('blur', function () { P.on = 0; kick(); });
  window.addEventListener('pointerdown', function (e) { rings.push({ x: e.clientX, y: e.clientY, t: performance.now() }); kick(); }, { passive: true });
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', size);
  size();
})();
