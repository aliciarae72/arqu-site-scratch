(function () {
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.way'));
  var flows = document.getElementById('flows');
  var grid = document.querySelector('.way-grid');
  var narrow = window.matchMedia('(max-width: 860px)');
  var current = null;

  function place() {
    var tile = current && document.getElementById('way-' + current);
    if (narrow.matches && tile) tile.insertAdjacentElement('afterend', flows);
    else grid.insertAdjacentElement('afterend', flows);
  }

  function wire() {
    if (!current) return;
    var flow = document.getElementById('flow-' + current);
    var svg = flow.querySelector('.wire');
    var box = svg.getBoundingClientRect();
    if (!box.width) return;
    var tile = document.getElementById('way-' + current).getBoundingClientRect();
    var x0 = ((tile.left + tile.width / 2 - box.left) / box.width) * 100;
    var anchors = Array.prototype.slice.call(flow.querySelectorAll('[data-anchor]'));
    var firstTop = Math.min.apply(
      null,
      anchors.map(function (a) {
        return a.getBoundingClientRect().top;
      }),
    );
    var d = 'M' + x0.toFixed(2) + ' 0 V26';
    anchors.forEach(function (a) {
      var r = a.getBoundingClientRect();
      if (Math.abs(r.top - firstTop) > 2) return;
      /* land on the first dot of the column's mark, not the middle of its rule */
      var x = ((r.left + 2.5 - box.left) / box.width) * 100;
      if (Math.abs(x - x0) < 1.5) x = x0;
      d += ' M' + x0.toFixed(2) + ' 26 H' + x.toFixed(2) + ' V56';
    });
    svg.querySelector('path').setAttribute('d', d);
  }

  function open(key, scroll) {
    current = current === key ? null : key;
    tiles.forEach(function (t) {
      var on = t.dataset.way === current;
      t.classList.toggle('on', on);
      t.classList.toggle('dim', !!current && !on);
      t.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    document.querySelectorAll('.flow').forEach(function (f) {
      var show = f.id === 'flow-' + current;
      f.hidden = !show;
      if (show) {
        f.querySelectorAll('.reveal, .wire').forEach(function (el) {
          el.style.animation = 'none';
          void el.offsetWidth;
          el.style.animation = '';
        });
      }
    });
    place();
    wire();
    window.dispatchEvent(new Event('arqu:layout'));
    if (current && scroll) {
      var target = document.getElementById('flow-' + current);
      var top = target.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.7) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  tiles.forEach(function (t) {
    t.addEventListener('click', function () {
      open(t.dataset.way, true);
    });
  });
  window.addEventListener('resize', function () {
    place();
    wire();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(wire);

  var start = new URLSearchParams(location.search).get('open');
  if (start === 'market' || start === 'programs') open(start, false);
})();
