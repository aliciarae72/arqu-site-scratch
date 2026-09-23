/* ══ RISK NARRATIVE — a slideshow, one plain-English read and one figure per
   slide. Arrows, pips, arrow keys and a swipe all move it; nothing autoplays. */
(function () {
  var rn = document.querySelector('[data-rn]');
  if (!rn) return;
  var show = rn.querySelector('[data-rn-show]');
  var slides = Array.prototype.slice.call(rn.querySelectorAll('.rn-slide'));
  var pips = Array.prototype.slice.call(rn.querySelectorAll('.rn-pip'));
  var count = rn.querySelector('[data-rn-count]');
  // Read off the pips so the slide count can never name a slide that is not there.
  var NAMES = pips.map(function (p) {
    return p.getAttribute('aria-label') || '';
  });
  // The visual each slide reveals on arrival; a slide without one reveals itself.
  var hosts = slides.map(function (s) {
    return s.querySelector('.rn-vis') || s;
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
    var host = hosts[cur];
    if (started && !host.classList.contains('in')) {
      requestAnimationFrame(function () {
        host.classList.add('in');
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
  // A slide can hold a control with gestures of its own. The carousel pages on a key
  // nothing inside it has taken, and swipes from anywhere except such a control, which
  // declares itself with data-owns-pointer.
  show.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    if (e.key === 'ArrowRight') {
      go(cur + 1);
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft') {
      go(cur - 1);
      e.preventDefault();
    }
  });
  var sx = null,
    pid = null;
  show.addEventListener(
    'pointerdown',
    function (e) {
      // Any new touch invalidates the last one, including a gesture this handler declines and
      // one the browser cancelled. A second finger landing mid-swipe makes it a multi-touch
      // gesture, not a swipe, so neither finger may finish it.
      var pending = sx !== null;
      sx = null;
      if (e.pointerType !== 'touch' || pending) return;
      if (e.target.closest && e.target.closest('[data-owns-pointer]')) return;
      sx = e.clientX;
      pid = e.pointerId;
    },
    { passive: true },
  );
  show.addEventListener(
    'pointercancel',
    function () {
      sx = null;
    },
    { passive: true },
  );
  show.addEventListener(
    'pointerup',
    function (e) {
      if (sx === null || e.pointerId !== pid) return;
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
        hosts[cur].classList.add('in');
      }, 350);
    },
    { threshold: 0.35 },
  ).observe(show);
})();
