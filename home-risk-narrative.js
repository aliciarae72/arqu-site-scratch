/* ══ RISK NARRATIVE — the format our narratives actually use: a slideshow, one
   interactive visual on the left, the plain-English read on the right. Arrows,
   pips, arrow keys and a swipe all move it; nothing autoplays. */
(function () {
  var rn = document.querySelector('[data-rn]');
  if (!rn) return;
  var BUILD = window.arquRiskVisuals;
  var show = rn.querySelector('[data-rn-show]');
  var slides = Array.prototype.slice.call(rn.querySelectorAll('.rn-slide'));
  var pips = Array.prototype.slice.call(rn.querySelectorAll('.rn-pip'));
  var count = rn.querySelector('[data-rn-count]');
  var NAMES = ['Wildfire', 'Seismic', 'Loss history'];
  var views = slides.map(function (s) {
    var host = s.querySelector('.rn-vis'),
      v = BUILD[host.getAttribute('data-vis')](host, s);
    host.addEventListener('pointermove', v.move, { passive: true });
    host.addEventListener('pointerleave', v.leave);
    v.host = host;
    return v;
  });
  var cur = 0,
    started = false;

  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      var on = k === cur;
      s.classList.toggle('is-on', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      if ('inert' in s) s.inert = !on;
    });
    pips.forEach(function (p, k) {
      p.setAttribute('aria-selected', k === cur ? 'true' : 'false');
    });
    count.textContent = '0' + (cur + 1) + ' / 0' + slides.length + ' · ' + NAMES[cur];
    var v = views[cur];
    if (started && !v.host.classList.contains('in')) {
      requestAnimationFrame(function () {
        v.host.classList.add('in');
        v.enter();
      });
    }
  }

  rn.querySelector('[data-rn-prev]').addEventListener('click', function () {
    go(cur - 1);
  });
  rn.querySelector('[data-rn-next]').addEventListener('click', function () {
    go(cur + 1);
  });
  pips.forEach(function (p, k) {
    p.addEventListener('click', function () {
      go(k);
    });
  });
  show.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') {
      go(cur + 1);
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft') {
      go(cur - 1);
      e.preventDefault();
    }
  });
  var sx = null;
  show.addEventListener(
    'pointerdown',
    function (e) {
      if (e.pointerType === 'touch') sx = e.clientX;
    },
    { passive: true },
  );
  show.addEventListener(
    'pointerup',
    function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
    },
    { passive: true },
  );

  go(0);
  new IntersectionObserver(
    function (es, io) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      started = true;
      setTimeout(function () {
        views[cur].host.classList.add('in');
        views[cur].enter();
      }, 350);
    },
    { threshold: 0.35 },
  ).observe(show);
})();
