/* ══ RISK NARRATIVE VISUALS — the left-hand side of each slide. One builder per
   slide; each fills its host and returns enter/move/leave for the slideshow in
   home-risk-narrative.js to drive. Loaded before that file. */
(function () {
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function el(tag, attrs, parent, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgPoint(svg, e) {
    var r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 480, y: ((e.clientY - r.top) / r.height) * 360 };
  }
  function liveBar(host) {
    var d = document.createElement('div');
    d.className = 'rn-live';
    d.innerHTML = '<span data-l></span><b data-r></b>';
    host.appendChild(d);
    return { l: d.querySelector('[data-l]'), r: d.querySelector('[data-r]') };
  }
  function hand(svg, draw) {
    if (!window.rough || !window.arquHand) return;
    var g = draw(rough.svg(svg), window.arquHand.opts);
    svg.insertBefore(g, svg.firstChild);
    window.arquHand.ink(g, 500, 0.5);
  }

  /* 1. wildfire: distance rings around the site. The pointer measures. */
  function wildfire(host) {
    var svg = el('svg', { viewBox: '0 0 480 360' }, host),
      CX = 240,
      CY = 176,
      MI = 50;
    [1, 2, 3].forEach(function (m) {
      el('circle', { class: 'ring', cx: CX, cy: CY, r: m * MI, style: 'transition-delay:' + m * 90 + 'ms' }, svg);
      el('text', { class: 'reveal-late', x: CX, y: CY - m * MI - 6, 'text-anchor': 'middle' }, svg, m + ' MI');
    });
    var live = el('circle', { class: 'live', cx: CX, cy: CY, r: 0 }, svg);
    el('circle', { class: 'pulse', cx: CX, cy: CY, r: 5 }, svg);
    el('circle', { class: 'site', cx: CX, cy: CY, r: 5 }, svg);
    el('text', { class: 'hand reveal-late', x: CX + 12, y: CY + 22 }, svg, 'the site');
    el('text', { class: 'hand reveal-late', x: 330, y: 34 }, svg, 'McKay Butte, 2019,');
    el('text', { class: 'hand reveal-late', x: 330, y: 54 }, svg, 'stopped about here');
    var bar = liveBar(host);
    bar.l.textContent = 'Move across the map';
    return {
      enter: function () {
        hand(svg, function (rc, o) {
          var g = el('g', {});
          g.appendChild(rc.circle(CX, CY, 2.5 * MI * 2, o(14, { strokeWidth: 1.8, roughness: 1.4 })));
          g.appendChild(
            rc.curve(
              [
                [350, 64],
                [342, 80],
                [CX + 90, CY - 86],
              ],
              o(15, { stroke: '#56514f', strokeWidth: 1.2, roughness: 1 }),
            ),
          );
          return g;
        });
      },
      move: function (e) {
        var p = svgPoint(svg, e),
          d = Math.min(185, Math.hypot(p.x - CX, p.y - CY)),
          mi = d / MI;
        live.setAttribute('r', d.toFixed(1));
        host.classList.add('probe');
        bar.l.textContent = mi.toFixed(1) + ' mi from the site';
        bar.r.textContent = mi < 2.5 ? 'Closer than any fire on record' : 'Past where the closest fire stopped';
      },
      leave: function () {
        host.classList.remove('probe');
        bar.l.textContent = 'Move across the map';
        bar.r.textContent = '';
      },
    };
  }

  /* 2. seismic: a magnitude scale, the site's mean and max, the USGS felt line.
     Each whole magnitude is ten times the ground motion, so the pointer reads
     any magnitude against the largest event on record. */
  function seismic(host) {
    var svg = el('svg', { viewBox: '0 0 480 360' }, host),
      Y = 240;
    function X(m) {
      return 40 + m * 80;
    }
    el(
      'rect',
      { class: 'reveal-late', x: X(0), y: Y - 16, width: X(2.5) - X(0), height: 16, rx: 3, fill: '#f3f1ff' },
      svg,
    );
    el('text', { class: 'hand reveal-late', x: X(0) + 4, y: Y - 24 }, svg, 'usually not felt (USGS)');
    el('line', { x1: X(0), y1: Y, x2: X(5), y2: Y, stroke: '#d5cec5' }, svg);
    for (var m = 0; m <= 5; m++) {
      el('line', { x1: X(m), y1: Y, x2: X(m), y2: Y + 6, stroke: '#d5cec5' }, svg);
      el('text', { x: X(m), y: Y + 22, 'text-anchor': 'middle' }, svg, 'M' + m);
    }
    [
      [1.42, 150, 'MEAN M1.42', '#8d8785'],
      [2.43, 74, 'LARGEST M2.43', '#5e54c8'],
    ].forEach(function (k, i) {
      var g = el('g', { class: 'grow', style: 'transition-delay:' + (200 + i * 160) + 'ms' }, svg);
      el('line', { x1: X(k[0]), y1: Y, x2: X(k[0]), y2: k[1], stroke: k[3] }, g);
      el('circle', { cx: X(k[0]), cy: k[1], r: 4.5, fill: k[3] }, g);
      el('text', { x: X(k[0]), y: k[1] - 12, 'text-anchor': 'middle', style: 'fill:' + k[3] }, g, k[2]);
    });
    el('circle', { class: 'pulse', cx: X(2.43), cy: 74, r: 4.5 }, svg);
    var probe = el('g', { class: 'live' }, svg);
    var pl = el('line', { x1: 0, y1: Y, x2: 0, y2: 40 }, probe);
    var bar = liveBar(host);
    bar.l.textContent = 'Slide along the scale';
    return {
      enter: function () {},
      move: function (e) {
        var p = svgPoint(svg, e),
          x = Math.max(X(0), Math.min(X(5), p.x)),
          mag = (x - 40) / 80;
        var ratio = Math.pow(10, mag - 2.43);
        pl.setAttribute('x1', x);
        pl.setAttribute('x2', x);
        host.classList.add('probe');
        bar.l.textContent = 'M' + mag.toFixed(1);
        bar.r.textContent =
          ratio >= 1
            ? '~' + (ratio < 10 ? ratio.toFixed(1) : Math.round(ratio)) + '× the ground motion of the largest on record'
            : '~1/' + Math.round(1 / ratio) + ' the ground motion of the largest on record';
      },
      leave: function () {
        host.classList.remove('probe');
        bar.l.textContent = 'Slide along the scale';
        bar.r.textContent = '';
      },
    };
  }

  /* 3. loss history: the bars are the controls */
  function loss(host, slide) {
    var bars = Array.prototype.slice.call(host.querySelectorAll('.rn-bar'));
    var val = function (b, k) {
      return +b.getAttribute('data-' + k);
    };
    var peak =
      bars.reduce(function (m, b) {
        return Math.max(m, val(b, 'incurred'));
      }, 0) || 1;
    var total = bars.reduce(function (s, b) {
      return s + val(b, 'incurred');
    }, 0);
    var claims = bars.reduce(function (s, b) {
      return s + val(b, 'claims');
    }, 0);
    slide.querySelector('[data-rn-loss-title]').textContent =
      (['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][bars.length] || bars.length) +
      ' years, ' +
      claims +
      ' claims, ' +
      money.format(total) +
      ' incurred.';
    var inc = slide.querySelector('[data-rn-incurred]'),
      yr = slide.querySelector('[data-rn-year]');
    var clm = slide.querySelector('[data-rn-claims]'),
      note = slide.querySelector('[data-rn-year-note]');
    var shown = null;
    function pick(b) {
      bars.forEach(function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      var to = val(b, 'incurred'),
        from = shown === null ? to : shown,
        t0 = 0;
      shown = to;
      (function tick(now) {
        if (!t0) t0 = now;
        var k = RM ? 1 : Math.min(1, (now - t0) / 520),
          ease = 1 - Math.pow(1 - k, 3);
        inc.textContent = money.format(Math.round(from + (to - from) * ease));
        if (k < 1) requestAnimationFrame(tick);
      })(performance.now());
      yr.textContent = b.getAttribute('data-year') + ' incurred';
      clm.textContent = b.getAttribute('data-claims');
      note.textContent = b.getAttribute('data-note');
    }
    bars.forEach(function (b) {
      b.style.setProperty('--h', Math.max(2, Math.round((val(b, 'incurred') / peak) * 100)));
      b.setAttribute(
        'aria-label',
        b.getAttribute('data-year') +
          ': ' +
          money.format(val(b, 'incurred')) +
          ' incurred, ' +
          val(b, 'claims') +
          ' claims',
      );
      b.addEventListener('click', function () {
        pick(b);
      });
      b.addEventListener('pointerenter', function () {
        pick(b);
      });
    });
    pick(
      bars.filter(function (b) {
        return b.hasAttribute('data-start');
      })[0] || bars[0],
    );
    return { enter: function () {}, move: function () {}, leave: function () {} };
  }

  window.arquRiskVisuals = { wildfire: wildfire, seismic: seismic, loss: loss };
})();
