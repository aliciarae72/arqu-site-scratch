/* Wires the hail map's readout, zoom and pan onto the page. The arithmetic lives in
   home-hail-map.js and the grid in hail-grid.js, both read off a named global. Classic
   scripts rather than modules, to match the rest of the page and because a module and a
   fetch both need HTTP — the map has to answer the pointer when the file is opened from
   disk too. home.html loads all three in order. */
(() => {
  const model = typeof module === 'object' && module.exports ? require('./home-hail-map.js') : window.hailMap;
  const HOME = { scale: 1, x: 0, y: 0 };
  const WHEEL_RATE = 0.0016;
  // A wheel notch in line mode is worth about this many pixels; page mode is a boxful.
  const LINE_PIXELS = 16;

  /* deltaY is measured in whatever deltaMode says — pixels, lines or pages. Firefox reports
     lines for a mouse wheel, which read as a near-zero zoom step when taken as pixels. */
  function wheelPixels(event, box) {
    if (event.deltaMode === 1) return event.deltaY * LINE_PIXELS;
    if (event.deltaMode === 2) return event.deltaY * box.height;
    return event.deltaY;
  }
  const STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  // Zero reframes, so this map is read with hasOwn.
  const ZOOMS = { '+': model.ZOOM_STEP, '=': model.ZOOM_STEP, '-': 1 / model.ZOOM_STEP, _: 1 / model.ZOOM_STEP, 0: 0 };

  const boxOf = (ui) => {
    const rect = ui.map.getBoundingClientRect();
    return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
  };
  const pointIn = (box, event) => ({ x: event.clientX - box.left, y: event.clientY - box.top });

  function apply(ui) {
    ui.pan.style.transform = `translate(${ui.view.x}px, ${ui.view.y}px) scale(${ui.view.scale})`;
  }

  /* The readout is pinned inside the map, so a cell at the right or bottom edge does not
     push it out over the figure's caption. */
  function show(ui, readout, at, box) {
    const said = `${readout.label}, ${readout.place}`;
    // Write only on a change: the live region announces each write, and measuring the
    // tooltip back forces a layout.
    if (said !== ui.read.textContent) {
      ui.label.textContent = readout.label;
      ui.place.textContent = readout.place;
      ui.read.textContent = said;
      // Unhidden before it is measured: a hidden element has no offsetWidth. hide() clears
      // the readout text, so a hidden tooltip never matches and always comes back through
      // this branch.
      ui.tip.hidden = false;
      ui.tipSize = { width: ui.tip.offsetWidth, height: ui.tip.offsetHeight };
    }
    ui.tip.style.left = `${Math.max(0, Math.min(at.x + 14, box.width - ui.tipSize.width))}px`;
    ui.tip.style.top = `${Math.max(0, Math.min(at.y + 14, box.height - ui.tipSize.height))}px`;
    ui.dot.hidden = true;
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

  function viewPointOf(ui, square, box) {
    const [lon, lat] = model.squareCentre(ui.grid, square);
    return model.imageToView(ui.view, model.imageOf(ui.grid, lon, lat), box);
  }

  function readoutAtPoint(ui, at, box) {
    const uv = model.viewToImage(ui.view, at, box);
    return model.readoutAt(ui.grid, uv.u, uv.v);
  }

  function hover(ui, at, box = boxOf(ui)) {
    const readout = readoutAtPoint(ui, at, box);
    if (!readout) return hide(ui);
    show(ui, readout, at, box);
  }

  /* Whatever the pointer was doing, the keyboard cursor is what the map still holds when
     the pointer leaves. With no cursor there is nothing to say. */
  function restCursor(ui, box = boxOf(ui)) {
    if (!ui.cursor) return hide(ui);
    const readout = model.readoutFor(ui.grid, ui.cursor);
    if (!readout) return hide(ui);
    const at = viewPointOf(ui, ui.cursor, box);
    show(ui, readout, at, box);
    mark(ui, at);
  }

  function wheel(ui, event, box = boxOf(ui)) {
    const at = pointIn(box, event);
    const next = model.zoomAt(ui.view, at, Math.exp(-wheelPixels(event, box) * WHEEL_RATE), box);
    // An unchanged view means the gesture cannot zoom — at rest, or already as close as it
    // goes. The page keeps the scroll rather than the map swallowing it.
    if (next === ui.view) return;
    event.preventDefault();
    ui.view = next;
    apply(ui);
    hover(ui, at, box);
  }

  function startDrag(ui, event) {
    const box = boxOf(ui);
    ui.drag = { box, from: pointIn(box, event), view: ui.view };
    // The drawing is about to move under the pointer, so whatever the readout names stops
    // being what is beneath it.
    hide(ui);
    ui.map.setPointerCapture(event.pointerId);
    ui.map.setAttribute('data-grabbing', '');
  }

  function moveDrag(ui, event) {
    // The box cannot change mid-drag: the pointer is captured.
    const { box, from, view } = ui.drag;
    const at = pointIn(box, event);
    ui.view = model.clampView({ scale: view.scale, x: view.x + at.x - from.x, y: view.y + at.y - from.y }, box);
    apply(ui);
  }

  function stopDrag(ui) {
    ui.drag = null;
    ui.map.removeAttribute('data-grabbing');
  }

  function endDrag(ui, event) {
    if (!ui.drag) return;
    stopDrag(ui);
    if (ui.map.hasPointerCapture(event.pointerId)) ui.map.releasePointerCapture(event.pointerId);
  }

  /* Pans only when the cursor has left the box, so walking around the middle of a zoomed
     map does not drag the whole drawing under the reader. */
  function keepInView(ui, square, box) {
    const at = viewPointOf(ui, square, box);
    if (at.x >= 0 && at.x <= box.width && at.y >= 0 && at.y <= box.height) return;
    const centred = { scale: ui.view.scale, x: ui.view.x + box.width / 2 - at.x, y: ui.view.y + box.height / 2 - at.y };
    ui.view = model.clampView(centred, box);
    apply(ui);
  }

  const middleOf = (box) => ({ x: box.width / 2, y: box.height / 2 });

  /* The first press puts the cursor on the square nearest the middle of what is on screen
     rather than stepping, so there is always something to read out. */
  function moveCursor(ui, step, box) {
    const middle = model.viewToImage(ui.view, middleOf(box), box);
    const wanted = ui.cursor
      ? { col: ui.cursor.col + step[0], row: ui.cursor.row + step[1] }
      : model.squareAt(ui.grid, ...model.lonLatAt(ui.grid, middle.u, middle.v));
    const landed = model.nearestFilled(ui.grid, wanted);
    if (!landed) return;
    ui.cursor = landed;
    keepInView(ui, landed, box);
    restCursor(ui, box);
  }

  function zoomKey(ui, factor, box) {
    ui.view = factor ? model.zoomAt(ui.view, middleOf(box), factor, box) : HOME;
    apply(ui);
    restCursor(ui, box);
  }

  function key(ui, event, box = boxOf(ui)) {
    if (STEPS[event.key]) {
      moveCursor(ui, STEPS[event.key], box);
    } else if (Object.hasOwn(ZOOMS, event.key)) {
      zoomKey(ui, ZOOMS[event.key], box);
    } else {
      return;
    }
    // The carousel reads defaultPrevented, so this is also what stops the slide paging.
    event.preventDefault();
  }

  /* A box that has shrunk can leave the old translation outside the new clamp range, and
     the drawing then stops covering it. */
  function refit(ui) {
    // A drag is anchored on the box and the view it started from. A resize invalidates both,
    // so the gesture ends here rather than resuming against numbers it never began with.
    stopDrag(ui);
    const box = boxOf(ui);
    ui.view = model.clampView(ui.view, box);
    apply(ui);
    restCursor(ui, box);
  }

  function wire(ui) {
    const on = (name, handler, options) => ui.map.addEventListener(name, handler, options);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => refit(ui)).observe(ui.map);
    on('pointermove', (e) => {
      if (ui.drag) return moveDrag(ui, e);
      const box = boxOf(ui);
      hover(ui, pointIn(box, e), box);
    });
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

  function mount(doc, grid) {
    const map = doc.querySelector('[data-hail-map]');
    if (!map) throw new Error('home-hail-map: [data-hail-map] is missing from the page');
    // The page loads hail-grid.js first. Say so rather than failing later on a null read.
    if (!grid) throw new Error('home-hail-map: hail-grid.js has to load before this file');
    const ui = {
      map,
      pan: map.querySelector('[data-hail-pan]'),
      tip: map.querySelector('[data-hail-tip]'),
      dot: map.querySelector('[data-hail-dot]'),
      label: map.querySelector('[data-hail-label]'),
      place: map.querySelector('[data-hail-place]'),
      read: map.querySelector('[data-hail-read]'),
      view: HOME,
      grid,
      tipSize: { width: 0, height: 0 },
      cursor: null,
      drag: null,
    };
    wire(ui);
    return ui;
  }

  const api = { mount, hover, wheel, key, refit, wheelPixels };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else mount(document, model.decodeGrid(window.hailGrid));
})();
