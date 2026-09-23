/* ══ INTERACTION LAYER — spine navigation and reveals ══════════════════════════
   Added 2026-09-15. Scroll position is the clock: nothing here autoplays, so
   scrolling back rewinds it. Adds NO element matching the edit layer's
   data-selector — see the note at the top of home-layers.css for why that is load-bearing. */
(function () {
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. the spine. A full-height rail; every dot sits where its section
        sits on the page, so the rail is a map of the scroll. ─────────────── */
  var SECTIONS = [
    ['page', 'Start'],
    ['human', 'Human-centered'],
    ['ways', 'Ways to work'],
    ['contact', 'Get in touch'],
    ['careers', 'Careers'],
  ]
    .map(function (p) {
      return { el: document.getElementById(p[0]), id: p[0], label: p[1] };
    })
    .filter(function (p) {
      return p.el;
    });

  var spine = document.getElementById('spine');
  var dotsEl = document.getElementById('dots');
  var DOTS = [];

  if (dotsEl && SECTIONS.length) {
    SECTIONS.forEach(function (sec) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sdot';
      b.setAttribute('aria-label', sec.label);
      b.innerHTML = '<i></i><b></b>';
      b.querySelector('b').textContent = sec.label;
      b.addEventListener('click', function () {
        sec.el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
      });
      dotsEl.appendChild(b);
      DOTS.push(b);
    });
  }

  /* Each dot goes where the fill line will be when its section becomes
     current, then dots are nudged apart so the last two never stack. */
  function placeDots() {
    if (!DOTS.length || !spine) return;
    var railH = spine.getBoundingClientRect().height;
    var span = document.documentElement.scrollHeight - window.innerHeight;
    if (!railH || span <= 0) return;
    var GAP = 30,
      ys = SECTIONS.map(function (sec) {
        var top = sec.el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.42;
        return Math.min(1, Math.max(0, top / span)) * railH;
      });
    for (var i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + GAP);
    ys[ys.length - 1] = Math.min(ys[ys.length - 1], railH);
    for (var j = ys.length - 2; j >= 0; j--) ys[j] = Math.min(ys[j], ys[j + 1] - GAP);
    DOTS.forEach(function (d, k) {
      d.style.setProperty('--y', ys[k].toFixed(1) + 'px');
    });
  }

  /* the header is sticky and its height changes with the viewport, so the rail measures it */
  var header = document.querySelector('.top');
  function spineTop() {
    if (spine && header)
      spine.style.setProperty('--spine-top', Math.round(header.getBoundingClientRect().bottom + 22) + 'px');
  }

  var active = -1;
  function spineTick() {
    spineTop();
    if (!DOTS.length) return;
    var mid = window.scrollY + window.innerHeight * 0.42;
    var cur = 0;
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].el.getBoundingClientRect().top + window.scrollY <= mid) cur = i;
    }
    if (cur !== active) {
      active = cur;
      DOTS.forEach(function (d, i) {
        d.setAttribute('aria-current', i === cur ? 'true' : 'false');
        d.classList.toggle('past', i < cur);
      });
    }
    var doc = document.documentElement;
    var span = doc.scrollHeight - window.innerHeight;
    var p = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;
    if (spine) spine.style.setProperty('--spine-p', (p * 100).toFixed(2) + '%');
  }

  /* ── 3. reveals. JS applies the attribute, so with JS off nothing is hidden. ── */
  var RISE = '.way-grid, .node, .steps li, .wins, .close > div, .g-head, .globe-stage, .g-say, .g-note, .dots-chart';
  function reveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll(RISE));
    if (!els.length) return;
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.classList.add('seen');
      });
      return;
    }
    els.forEach(function (el, i) {
      el.setAttribute('data-rise', '');
      el.style.transitionDelay = (i % 5) * 70 + 'ms';
    });
    var fired = false;
    var io = new IntersectionObserver(
      function (entries) {
        fired = true;
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('seen');
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    els.forEach(function (el) {
      io.observe(el);
    });
    /* Failsafe: if the observer never reports at all, the page must not stay blank.
       A working observer reports every target once right after observe(). */
    setTimeout(function () {
      if (fired) return;
      els.forEach(function (el) {
        el.classList.add('seen');
      });
    }, 2200);
  }

  /* ── wiring. One passive scroll listener drives the spine. ── */
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      spineTick();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener(
    'resize',
    function () {
      placeDots();
      spineTick();
    },
    { passive: true },
  );

  window.addEventListener('load', function () {
    placeDots();
    spineTick();
  });
  if ('ResizeObserver' in window)
    new ResizeObserver(function () {
      placeDots();
    }).observe(document.body);

  reveals();
  spineTick();
})();
