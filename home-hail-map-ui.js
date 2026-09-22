/* Wires the hail map's readout, zoom and pan onto the page. The arithmetic all lives in
   home-hail-map.js, which this file reads off `window.hailMap`; a script-tag page has no
   module system, so the pair loads in that order and shares one named global. */
(() => {
  const model = typeof module === 'object' && module.exports ? require('./home-hail-map.js') : window.hailMap;
  const HOME = { scale: 1, x: 0, y: 0 };
  const WHEEL_RATE = 0.0016;
  const STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const ZOOMS = { '+': model.ZOOM_STEP, '=': model.ZOOM_STEP, '-': 1 / model.ZOOM_STEP, _: 1 / model.ZOOM_STEP };

  const boxOf = (ui) => {
    const rect = ui.map.getBoundingClientRect();
    return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
  };
  const pointAt = (ui, event) => {
    const box = boxOf(ui);
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  function apply(ui) {
    ui.pan.style.transform = `translate(${ui.view.x}px, ${ui.view.y}px) scale(${ui.view.scale})`;
  }

  /* The readout is pinned inside the map, so a cell at the right or bottom edge does not
     push it out over the figure's caption. */
  function show(ui, readout, at) {
    const box = boxOf(ui);
    ui.label.textContent = readout.label;
    ui.place.textContent = readout.place;
    ui.read.textContent = `${readout.label}, ${readout.place}`;
    ui.tip.hidden = false;
    const width = ui.tip.offsetWidth;
    const height = ui.tip.offsetHeight;
    ui.tip.style.left = `${Math.max(0, Math.min(at.x + 14, box.width - width))}px`;
    ui.tip.style.top = `${Math.max(0, Math.min(at.y + 14, box.height - height))}px`;
  }

  function hide(ui) {
    ui.tip.hidden = true;
    ui.dot.hidden = true;
    ui.read.textContent = '';
  }

  /* A pointer reader can see what they are pointing at. A keyboard reader cannot, so the
     cursor's cell is marked on the drawing beside its readout. */
  function mark(ui, at) {
    ui.dot.style.left = `${at.x}px`;
    ui.dot.style.top = `${at.y}px`;
    ui.dot.hidden = false;
  }

  function readoutAtPoint(ui, at) {
    if (!ui.grid) return null;
    const box = boxOf(ui);
    const uv = model.viewToImage(ui.view, at, box);
    return model.readoutAt(ui.grid, uv.u, uv.v);
  }

  function hover(ui, at) {
    const readout = readoutAtPoint(ui, at);
    if (!readout) return hide(ui);
    show(ui, readout, at);
    ui.dot.hidden = true;
  }

  /* Whatever the pointer was doing, the keyboard cursor is what the map still holds when
     the pointer leaves. With no cursor there is nothing to say. */
  function restCursor(ui) {
    if (!ui.grid || !ui.cursor) return hide(ui);
    const readout = model.readoutFor(ui.grid, ui.cursor);
    if (!readout) return hide(ui);
    const [lon, lat] = model.squareCentre(ui.grid, ui.cursor);
    const at = model.imageToView(ui.view, model.imageOf(ui.grid, lon, lat), boxOf(ui));
    show(ui, readout, at);
    mark(ui, at);
  }

  function wheel(ui, event) {
    const at = pointAt(ui, event);
    const next = model.zoomAt(ui.view, at, Math.exp(-event.deltaY * WHEEL_RATE), boxOf(ui));
    // An unchanged view means the gesture cannot zoom — at rest, or already as close as it
    // goes. The page keeps the scroll rather than the map swallowing it.
    if (next === ui.view) return;
    event.preventDefault();
    ui.view = next;
    apply(ui);
    hover(ui, at);
  }

  function startDrag(ui, event) {
    // The carousel around this map turns a touch drag into a slide change. Panning the map
    // is not paging the carousel, so the gesture stops here.
    event.stopPropagation();
    ui.drag = { from: pointAt(ui, event), view: ui.view };
    ui.map.setPointerCapture(event.pointerId);
    ui.map.setAttribute('data-grabbing', '');
  }

  function moveDrag(ui, event) {
    const at = pointAt(ui, event);
    ui.view = model.clampView(
      {
        scale: ui.drag.view.scale,
        x: ui.drag.view.x + at.x - ui.drag.from.x,
        y: ui.drag.view.y + at.y - ui.drag.from.y,
      },
      boxOf(ui),
    );
    apply(ui);
  }

  function endDrag(ui, event) {
    if (!ui.drag) return;
    event.stopPropagation();
    ui.drag = null;
    ui.map.removeAttribute('data-grabbing');
    if (ui.map.hasPointerCapture(event.pointerId)) ui.map.releasePointerCapture(event.pointerId);
  }

  /* Pans only when the cursor has left the box, so walking around the middle of a zoomed
     map does not drag the whole drawing under the reader. */
  function keepInView(ui, square) {
    const box = boxOf(ui);
    const [lon, lat] = model.squareCentre(ui.grid, square);
    const at = model.imageToView(ui.view, model.imageOf(ui.grid, lon, lat), box);
    if (at.x >= 0 && at.x <= box.width && at.y >= 0 && at.y <= box.height) return;
    const centred = { scale: ui.view.scale, x: ui.view.x + box.width / 2 - at.x, y: ui.view.y + box.height / 2 - at.y };
    ui.view = model.clampView(centred, box);
    apply(ui);
  }

  function moveCursor(ui, step) {
    if (!ui.grid) return;
    const box = boxOf(ui);
    const middle = model.viewToImage(ui.view, { x: box.width / 2, y: box.height / 2 }, box);
    const from = ui.cursor || model.squareAt(ui.grid, ...model.lonLatAt(ui.grid, middle.u, middle.v));
    const wanted = ui.cursor ? { col: from.col + step[0], row: from.row + step[1] } : from;
    const landed = model.nearestFilled(ui.grid, wanted);
    if (!landed) return;
    ui.cursor = landed;
    keepInView(ui, landed);
    restCursor(ui);
  }

  function zoomKey(ui, factor) {
    const box = boxOf(ui);
    ui.view = factor ? model.zoomAt(ui.view, { x: box.width / 2, y: box.height / 2 }, factor, box) : HOME;
    apply(ui);
    restCursor(ui);
  }

  function key(ui, event) {
    if (STEPS[event.key]) {
      moveCursor(ui, STEPS[event.key]);
    } else if (ZOOMS[event.key]) {
      zoomKey(ui, ZOOMS[event.key]);
    } else if (event.key === '0') {
      zoomKey(ui, 0);
    } else {
      return;
    }
    event.preventDefault();
    // The carousel around this map pages on the arrow keys. Walking the cursor is not
    // paging the carousel, so a key the map has answered stops here.
    event.stopPropagation();
  }

  function wire(ui) {
    const on = (name, handler, options) => ui.map.addEventListener(name, handler, options);
    on('pointermove', (e) => (ui.drag ? moveDrag(ui, e) : hover(ui, pointAt(ui, e))));
    on('pointerleave', () => restCursor(ui));
    on('pointerdown', (e) => startDrag(ui, e));
    on('pointerup', (e) => endDrag(ui, e));
    on('pointercancel', (e) => endDrag(ui, e));
    on('wheel', (e) => wheel(ui, e), { passive: false });
    on('keydown', (e) => key(ui, e));
    on('blur', () => {
      ui.cursor = null;
      hide(ui);
    });
  }

  function load(ui, fetcher) {
    return fetcher('hail-grid.json')
      .then((res) => {
        if (!res.ok) throw new Error(`home-hail-map: hail-grid.json answered ${res.status}`);
        return res.json();
      })
      .then((doc) => {
        ui.grid = model.decodeGrid(doc);
        return ui;
      });
  }

  function mount(doc, fetcher) {
    const map = doc.querySelector('[data-hail-map]');
    if (!map) throw new Error('home-hail-map: [data-hail-map] is missing from the page');
    const ui = {
      map,
      pan: map.querySelector('[data-hail-pan]'),
      tip: map.querySelector('[data-hail-tip]'),
      dot: map.querySelector('[data-hail-dot]'),
      label: map.querySelector('[data-hail-label]'),
      place: map.querySelector('[data-hail-place]'),
      read: map.querySelector('[data-hail-read]'),
      view: HOME,
      grid: null,
      cursor: null,
      drag: null,
    };
    wire(ui);
    load(ui, fetcher);
    return ui;
  }

  const api = { mount, wire, load, show, hide, hover, wheel, key, moveCursor, restCursor, boxOf, apply };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else mount(document, (url) => fetch(url));
})();
