/* ══ SECTOR ICONS — a crane, a building, a power-line pylon and a magnifier
   over the four open-market columns, drawn with the page's own pen (window.arquHand). Each
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
      ['line', 4, 57, 68, 57],
      ['line', 26, 57, 33, 6],
      ['line', 46, 57, 39, 6],
      ['line', 33, 6, 39, 6],
      ['line', 16, 16, 56, 16],
      ['line', 20, 27, 52, 27],
      [
        'linearPath',
        [
          [27, 52],
          [44, 42],
          [29, 34],
          [42, 27],
          [31, 20],
          [40, 12],
        ],
      ],
      [
        'curve',
        [
          [16, 17],
          [8, 23],
          [0, 21],
        ],
      ],
      [
        'curve',
        [
          [20, 28],
          [11, 34],
          [2, 32],
        ],
      ],
      [
        'curve',
        [
          [52, 28],
          [61, 34],
          [70, 32],
        ],
      ],
      [
        'curve',
        [
          [56, 17],
          [64, 23],
          [72, 21],
        ],
        true,
      ],
    ],
    more: [
      ['line', 4, 57, 68, 57],
      ['rectangle', 8, 37, 18, 20],
      ['rectangle', 26, 27, 16, 30],
      ['rectangle', 42, 43, 14, 14],
      ['circle', 50, 18, 18, true],
      ['line', 56.5, 24.5, 66, 34],
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
