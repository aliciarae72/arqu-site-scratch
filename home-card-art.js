/* ══ CARD ART — open market: one dot opening out to many. Programs: many dots
   closing into one. Same dots, same springs, opposite direction, so the two
   cards read as a pair. Idle, each breathes through its move on a slow loop;
   hovered or opened, it commits to its end state and leans toward the pointer. */
(function () {
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = 13, PERIOD = 5600;
  function rnd(i, s) { var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }

  function Art(cv) {
    var kind = cv.getAttribute('data-art'), card = cv.closest('.way'), ctx = cv.getContext('2d');
    var st = { w: 0, h: 0, hover: false, px: 0, py: 0, core: 1, raf: 0, seen: false, t0: performance.now() };
    var dots = [];
    for (var i = 0; i < N; i++) {
      dots.push({ x: 0, y: 0, vx: 0, vy: 0, ang: i * 2.39996 + rnd(i, 3) * 0.5, rad: 0.38 + 0.62 * rnd(i, 1),
        r: 2.4 + 2.6 * rnd(i, 2), k: 0.035 + rnd(i, 4) * 0.03, lag: rnd(i, 5) * 0.12, fill: i % 4 === 0 });
    }

    function size() {
      var dpr = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
      if (!r.width) return;
      st.w = r.width; st.h = r.height;
      cv.width = r.width * dpr | 0; cv.height = r.height * dpr | 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots.forEach(function (d) { if (!d.x) { d.x = st.w / 2; d.y = st.h / 2; } });
      if (RM) paint(1);
    }

    /* 0 = gathered into one, 1 = spread across the market */
    function spreadAt(now, lag) {
      if (st.hover || card.classList.contains('on')) return kind === 'market' ? 1 : 0;
      var u = ((now - st.t0) / PERIOD + lag) % 1;
      var open = u > 0.12 && u < 0.62;
      return kind === 'market' ? (open ? 1 : 0) : (open ? 0 : 1);
    }

    function step(now) {
      var cx = st.w / 2, cy = st.h / 2, RX = st.w * 0.40, RY = st.h * 0.36, gathered = 0;
      var reach = st.hover ? 1.08 : 1;
      dots.forEach(function (d, i) {
        var S = RM ? 1 : spreadAt(now, d.lag), sway = RM ? 0 : 2.2 * S;
        var tx = cx + Math.cos(d.ang) * d.rad * RX * S * reach + Math.sin(now / 900 + i) * sway;
        var ty = cy + Math.sin(d.ang) * d.rad * RY * S * reach + Math.cos(now / 1100 + i) * sway;
        if (st.hover && S) { tx += (st.px - tx) * 0.12; ty += (st.py - ty) * 0.12; }
        d.vx = (d.vx + (tx - d.x) * d.k) * 0.86; d.vy = (d.vy + (ty - d.y) * d.k) * 0.86;
        d.x += d.vx; d.y += d.vy;
        if (Math.abs(d.x - cx) + Math.abs(d.y - cy) < 6) gathered++;
      });
      st.core += ((kind === 'programs' ? 3.5 + 5 * gathered / N : 5.5) - st.core) * 0.12;
    }

    function paint() {
      var cx = st.w / 2, cy = st.h / 2;
      ctx.clearRect(0, 0, st.w, st.h);
      dots.forEach(function (d) {
        var dist = Math.hypot(d.x - cx, d.y - cy), a = Math.min(1, dist / 18);
        if (a < 0.02) return;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(d.x, d.y);
        ctx.strokeStyle = 'rgba(94,84,200,' + (0.16 * a).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
      });
      dots.forEach(function (d) {
        var a = Math.min(1, Math.hypot(d.x - cx, d.y - cy) / 18);
        if (a < 0.02) return;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (0.5 + 0.5 * a), 0, 6.2832);
        ctx.fillStyle = d.fill ? 'rgba(94,84,200,' + a + ')' : 'rgba(255,255,255,' + a + ')';
        ctx.fill();
        if (!d.fill) { ctx.strokeStyle = 'rgba(94,84,200,' + (0.8 * a) + ')'; ctx.lineWidth = 1.2; ctx.stroke(); }
      });
      ctx.beginPath(); ctx.arc(cx, cy, st.core, 0, 6.2832);
      ctx.fillStyle = '#5e54c8'; ctx.fill();
    }

    function frame(now) {
      st.raf = 0;
      step(now); paint();
      if (st.seen) st.raf = requestAnimationFrame(frame);
    }

    card.addEventListener('pointerenter', function () { st.hover = true; });
    card.addEventListener('pointerleave', function () { st.hover = false; });
    card.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect(); st.px = e.clientX - r.left; st.py = e.clientY - r.top;
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(cv);
    size();
    if (RM) { for (var k = 0; k < 240; k++) step(0); paint(); return; }
    new IntersectionObserver(function (es) {
      st.seen = es[0].isIntersecting;
      if (st.seen && !st.raf) st.raf = requestAnimationFrame(frame);
    }).observe(cv);
  }

  Array.prototype.forEach.call(document.querySelectorAll('canvas[data-art]'), Art);
})();
