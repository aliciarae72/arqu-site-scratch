/* The #lines section: a casualty dot matrix and a property hail map.
   In the matrix one dot is one record, and every column shares one pitch and one
   width, so the columns compare by area and the drop to a single dot reads true. */
(function (root, build) {
  var api = build();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.mount(root.document, root);
})(typeof window === 'undefined' ? null : window, function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var PER_ROW = 36;
  var PITCH = 10;
  var RING_RADIUS = 30;
  var FLOURISH_PUBLIC = 'https://public.flourish.studio/visualisation/';
  var FLOURISH_EMBED = 'https://flo.uri.sh/visualisation/';

  function dotGrid(count) {
    var rows = Math.ceil(count / PER_ROW);
    return { rows: rows, width: PER_ROW * PITCH, height: rows * PITCH };
  }

  /* bottom-up, left to right; the part row on top is centred, so a lone dot sits under its count */
  function dotPosition(index, count) {
    var rows = dotGrid(count).rows;
    var row = Math.floor(index / PER_ROW);
    var inRow = row === rows - 1 ? count - row * PER_ROW : PER_ROW;
    return {
      x: ((index % PER_ROW) + (PER_ROW - inRow) / 2) * PITCH + PITCH / 2,
      y: (rows - 1 - row) * PITCH + PITCH / 2,
    };
  }

  /* a zero-length segment with a round cap draws one dot, so a column is one path */
  function dotPath(count) {
    var parts = [];
    for (var i = 0; i < count; i++) {
      var dot = dotPosition(i, count);
      parts.push('M' + dot.x + ' ' + dot.y + 'h0');
    }
    return parts.join('');
  }

  function svgElement(doc, name, attrs) {
    var el = doc.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function buildColumn(doc, stack) {
    var count = Number(stack.getAttribute('data-count'));
    var grid = dotGrid(count);
    var svg = svgElement(doc, 'svg', { viewBox: '0 0 ' + grid.width + ' ' + grid.height, 'aria-hidden': 'true' });
    svg.appendChild(svgElement(doc, 'path', { class: 'dots', d: dotPath(count) }));
    if (stack.hasAttribute('data-punchline')) {
      var last = dotPosition(count - 1, count);
      svg.appendChild(svgElement(doc, 'circle', { class: 'dots-ring', cx: last.x, cy: last.y, r: RING_RADIUS }));
    }
    stack.appendChild(svg);
    return svg;
  }

  function revealOnView(win, el) {
    if (!win.IntersectionObserver) {
      el.classList.add('in');
      return;
    }
    var observer = new win.IntersectionObserver(
      function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        el.classList.add('in');
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
  }

  function flourishUrls(id) {
    return { thumbnail: FLOURISH_PUBLIC + id + '/thumbnail', embed: FLOURISH_EMBED + id + '/embed' };
  }

  function embedHail(doc, host, src) {
    var frame = doc.createElement('iframe');
    frame.setAttribute('src', src);
    frame.setAttribute('title', host.getAttribute('data-title'));
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    host.appendChild(frame);
    host.setAttribute('data-state', 'live');
  }

  /* An unpublished Flourish embed renders an Access Denied page inside the frame.
     Its thumbnail exists only once published, and an image load/error event
     crosses origins without CORS, so the thumbnail decides whether to embed. */
  function mountHail(doc, win, host) {
    var id = host.getAttribute('data-flourish');
    var urls = flourishUrls(id);
    var probe = new win.Image();
    probe.onload = function () {
      embedHail(doc, host, urls.embed);
    };
    probe.onerror = function () {
      host.setAttribute('data-state', 'unpublished');
      win.console.warn('home-lines: Flourish visualisation ' + id + ' is not published (' + urls.thumbnail + ' failed)');
    };
    probe.src = urls.thumbnail;
  }

  function required(doc, selector) {
    var el = doc.querySelector(selector);
    if (!el) throw new Error('home-lines: ' + selector + ' is missing from the page');
    return el;
  }

  function mount(doc, win) {
    var chart = required(doc, '.dots-chart');
    Array.prototype.forEach.call(chart.querySelectorAll('.dots-stack[data-count]'), function (stack) {
      buildColumn(doc, stack);
    });
    revealOnView(win, chart);
    mountHail(doc, win, required(doc, '.hail-map[data-flourish]'));
  }

  return {
    PER_ROW: PER_ROW,
    PITCH: PITCH,
    dotGrid: dotGrid,
    dotPosition: dotPosition,
    dotPath: dotPath,
    buildColumn: buildColumn,
    revealOnView: revealOnView,
    flourishUrls: flourishUrls,
    mountHail: mountHail,
    mount: mount,
  };
});
