/* ══ CARD ART — open market: one dot opening out to many. Programs: many dots
   closing into one. Same dots, same springs, opposite direction, so the two
   cards read as a pair. Idle, each breathes through its move on a slow loop;
   hovered or opened, it commits to its end state and leans toward the pointer. */
(function () {
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = 13,
    PERIOD = 5600;
  function rnd(i, s) {
    var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function makeDots() {
    var dots = [];
    for (var i = 0; i < N; i++) {
      dots.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ang: i * 2.39996 + rnd(i, 3) * 0.5,
        rad: 0.38 + 0.62 * rnd(i, 1),
        r: 2.4 + 2.6 * rnd(i, 2),
        k: 0.035 + rnd(i, 4) * 0.03,
        lag: rnd(i, 5) * 0.12,
        fill: i % 4 === 0,
      });
    }
    return dots;
  }

  function size(art) {
    var st = art.st,
      dpr = Math.min(2, window.devicePixelRatio || 1),
      r = art.cv.getBoundingClientRect();
    if (!r.width) return;
    st.w = r.width;
    st.h = r.height;
    art.cv.width = (r.width * dpr) | 0;
    art.cv.height = (r.height * dpr) | 0;
    art.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    art.dots.forEach(function (d) {
      if (!d.x) {
        d.x = st.w / 2;
        d.y = st.h / 2;
      }
    });
    if (RM) paint(art);
  }

  /* 0 = gathered into one, 1 = spread across the market */
  function spreadAt(art, now, lag) {
    var market = art.kind === 'market';
    if (art.st.hover || art.card.classList.contains('on')) return market ? 1 : 0;
    var u = ((now - art.st.t0) / PERIOD + lag) % 1;
    var open = u > 0.12 && u < 0.62;
    return open === market ? 1 : 0;
  }

  function step(art, now) {
    var st = art.st,
      cx = st.w / 2,
      cy = st.h / 2,
      RX = st.w * 0.4,
      RY = st.h * 0.36,
      gathered = 0;
    var reach = st.hover ? 1.08 : 1;
    art.dots.forEach(function (d, i) {
      var S = RM ? 1 : spreadAt(art, now, d.lag),
        sway = RM ? 0 : 2.2 * S;
      var tx = cx + Math.cos(d.ang) * d.rad * RX * S * reach + Math.sin(now / 900 + i) * sway;
      var ty = cy + Math.sin(d.ang) * d.rad * RY * S * reach + Math.cos(now / 1100 + i) * sway;
      if (st.hover && S) {
        tx += (st.px - tx) * 0.12;
        ty += (st.py - ty) * 0.12;
      }
      d.vx = (d.vx + (tx - d.x) * d.k) * 0.86;
      d.vy = (d.vy + (ty - d.y) * d.k) * 0.86;
      d.x += d.vx;
      d.y += d.vy;
      if (Math.abs(d.x - cx) + Math.abs(d.y - cy) < 6) gathered++;
    });
    st.core += ((art.kind === 'programs' ? 3.5 + (5 * gathered) / N : 5.5) - st.core) * 0.12;
  }

  /* a dot fades in with its distance from the core, so gathered dots vanish into it */
  function reachOf(art, d) {
    return Math.min(1, Math.hypot(d.x - art.st.w / 2, d.y - art.st.h / 2) / 18);
  }

  function paintLines(art) {
    var ctx = art.ctx,
      cx = art.st.w / 2,
      cy = art.st.h / 2;
    art.dots.forEach(function (d) {
      var a = reachOf(art, d);
      if (a < 0.02) return;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(d.x, d.y);
      ctx.strokeStyle = 'rgba(94,84,200,' + (0.16 * a).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function paintDots(art) {
    var ctx = art.ctx;
    art.dots.forEach(function (d) {
      var a = reachOf(art, d);
      if (a < 0.02) return;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * (0.5 + 0.5 * a), 0, 6.2832);
      ctx.fillStyle = d.fill ? 'rgba(94,84,200,' + a + ')' : 'rgba(255,255,255,' + a + ')';
      ctx.fill();
      if (!d.fill) {
        ctx.strokeStyle = 'rgba(94,84,200,' + 0.8 * a + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });
  }

  function paint(art) {
    var ctx = art.ctx,
      st = art.st;
    ctx.clearRect(0, 0, st.w, st.h);
    paintLines(art);
    paintDots(art);
    ctx.beginPath();
    ctx.arc(st.w / 2, st.h / 2, st.core, 0, 6.2832);
    ctx.fillStyle = '#5e54c8';
    ctx.fill();
  }

  function listen(art) {
    var st = art.st;
    art.card.addEventListener('pointerenter', function () {
      st.hover = true;
    });
    art.card.addEventListener('pointerleave', function () {
      st.hover = false;
    });
    art.card.addEventListener(
      'pointermove',
      function (e) {
        var r = art.cv.getBoundingClientRect();
        st.px = e.clientX - r.left;
        st.py = e.clientY - r.top;
      },
      { passive: true },
    );
    if ('ResizeObserver' in window)
      new ResizeObserver(function () {
        size(art);
      }).observe(art.cv);
  }

  function Art(cv) {
    var art = {
      cv: cv,
      ctx: cv.getContext('2d'),
      kind: cv.getAttribute('data-art'),
      card: cv.closest('.way'),
      dots: makeDots(),
      st: { w: 0, h: 0, hover: false, px: 0, py: 0, core: 1, raf: 0, seen: false, t0: performance.now() },
    };
    listen(art);
    size(art);
    if (RM) {
      for (var k = 0; k < 240; k++) step(art, 0);
      paint(art);
      return;
    }
    function frame(now) {
      art.st.raf = 0;
      step(art, now);
      paint(art);
      if (art.st.seen) art.st.raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(function (es) {
      art.st.seen = es[0].isIntersecting;
      if (art.st.seen && !art.st.raf) art.st.raf = requestAnimationFrame(frame);
    }).observe(cv);
  }

  Array.prototype.forEach.call(document.querySelectorAll('canvas[data-art]'), Art);
})();
