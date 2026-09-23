/* ══ SECTOR ICONS — a crane, a building and a wind turbine over the three
   open-market columns, drawn with the page's own pen (window.arquHand). Each
   inks on when its column comes into view, and again whenever the flow is
   closed and reopened, in step with the columns' own reveal. Ink carries the
   drawing; one purple detail per icon carries the brand. */
(function () {
  var H = window.arquHand;
  if (!H) return;
  var LINE = { stroke: H.INK, strokeWidth: 1.5, roughness: 0.7, bowing: 0.6, disableMultiStroke: true };
  var ACCENT = { stroke: H.PURPLE, strokeWidth: 1.8, roughness: 0.6, bowing: 0.5, disableMultiStroke: true };

  /* rough.js calls in a 72×60 box, in drawing order; a trailing true marks the purple detail */
  var ICONS = {
    construction: [
      ['line', 4, 57, 46, 57],
      ['line', 20, 57, 20, 12],
      ['line', 27, 57, 27, 12],
      [
        'linearPath',
        [
          [20, 52],
          [27, 43],
          [20, 34],
          [27, 25],
          [20, 16],
        ],
      ],
      ['line', 3, 12, 69, 12],
      [
        'linearPath',
        [
          [5, 12],
          [23.5, 3],
          [67, 12],
        ],
      ],
      ['rectangle', 5, 13, 9, 6],
      ['line', 57, 12, 57, 33],
      ['rectangle', 50, 33, 14, 8, true],
    ],
    realEstate: [
      ['line', 4, 57, 68, 57],
      [
        'linearPath',
        [
          [14, 57],
          [14, 9],
          [40, 9],
          [40, 57],
        ],
      ],
      ['line', 20, 19, 26, 19],
      ['line', 30, 19, 35, 19],
      ['line', 20, 29, 26, 29],
      ['line', 30, 29, 35, 29],
      ['line', 20, 39, 26, 39],
      ['line', 30, 39, 35, 39],
      [
        'linearPath',
        [
          [40, 29],
          [61, 29],
          [61, 57],
        ],
      ],
      ['line', 46, 38, 55, 38],
      ['line', 46, 47, 55, 47],
      [
        'linearPath',
        [
          [23, 57],
          [23, 47],
          [31, 47],
          [31, 57],
        ],
        true,
      ],
    ],
    energy: [
      ['line', 6, 57, 66, 57],
      ['line', 31, 57, 34, 24],
      ['line', 38, 57, 36, 24],
      [
        'curve',
        [
          [35, 17],
          [34.6, 9],
          [35.6, 1],
        ],
      ],
      [
        'curve',
        [
          [38, 22.5],
          [45, 25],
          [51, 30.5],
        ],
      ],
      [
        'curve',
        [
          [32, 22.5],
          [25.5, 27],
          [19, 29],
        ],
      ],
      ['line', 57, 57, 57.5, 40],
      ['line', 57.5, 37.5, 57.5, 29],
      ['line', 59, 39, 65, 42.5],
      ['line', 56, 39, 50, 42.5],
      ['circle', 35, 20.5, 6, true],
    ],
  };

  function draw(svg, column) {
    var parts = ICONS[svg.getAttribute('data-icon')];
    if (!parts) return;
    var rc = rough.svg(svg),
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    parts.forEach(function (part, k) {
      var accent = part[part.length - 1] === true;
      var args = part.slice(1, accent ? -1 : part.length);
      args.push(H.opts(60 + column * 16 + k, accent ? ACCENT : LINE));
      g.appendChild(rc[part[0]].apply(rc, args));
    });
    svg.textContent = '';
    svg.appendChild(g);
    H.ink(g, 380 + column * 180, 0.32);
  }

  var icons = Array.prototype.slice.call(document.querySelectorAll('.sector-icon'));
  if (!icons.length) return;
  if (!('IntersectionObserver' in window)) {
    icons.forEach(draw);
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (en) {
        var svg = en.target;
        if (!en.isIntersecting || svg.__inked) return;
        svg.__inked = true;
        draw(svg, icons.indexOf(svg));
      });
    },
    { threshold: 0.4 },
  );
  icons.forEach(function (svg) {
    io.observe(svg);
  });
})();
