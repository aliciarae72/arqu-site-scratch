/* The hail map answers the pointer. The drawing is a flat image, so nothing in it can
   carry a hover of its own; what the pointer lands on is worked out from the grid the
   generator ships beside it.

   The NOAA cells sit on a flat-top hexagonal lattice. A hexagonal lattice is its own
   Voronoi diagram, so the cell under a point is the cell whose centre is nearest — which
   makes the lookup nine distance comparisons rather than a search through 11,026 rings,
   and keeps the payload at a couple of kilobytes instead of a third of a megabyte. */
(() => {
  const EMPTY = -1;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 1.35;
  const SEARCH_RINGS = 40;
  const RUN = /([a-z.])(\d*)/g;

  /* Runs are written as a symbol and an optional length: `a` is one Very Low square,
     `.48` is forty-eight empty ones. Letters, not digits, so a length can never be read
     as the next symbol. */
  function decodeGrid(doc) {
    const size = doc.bounds.cols * doc.bounds.rows;
    const squares = new Int8Array(size).fill(EMPTY);
    let at = 0;
    for (const [, symbol, length] of doc.grid.matchAll(RUN)) {
      const run = length === '' ? 1 : Number(length);
      if (symbol !== '.') squares.fill(symbol.charCodeAt(0) - 97, at, at + run);
      at += run;
    }
    if (at !== size) {
      throw new Error(`hail-grid: ${at} squares for a ${doc.bounds.cols}x${doc.bounds.rows} grid`);
    }
    return { ...doc, squares };
  }

  const filledSquares = (grid) => grid.squares.reduce((n, s) => n + (s === EMPTY ? 0 : 1), 0);

  /* Odd columns sit half a row above even ones, which is what makes the lattice hexagonal
     rather than rectangular. JS leaves `%` negative for negative columns, hence the fold. */
  const rowOffset = (col) => (((col % 2) + 2) % 2 === 1 ? 0.5 : 0);

  function squareCentre(grid, square) {
    const { west, south, dlon, dlat } = grid.lattice;
    return [west + square.col * dlon, south + (square.row + rowOffset(square.col)) * dlat];
  }

  function holds(grid, col, row) {
    const { col: col0, row: row0, cols, rows } = grid.bounds;
    return col >= col0 && col < col0 + cols && row >= row0 && row < row0 + rows;
  }

  /* Longitude is compressed by cos(latitude) on this frame, so distances are compared in
     the projected space the map is drawn in. In raw degrees the lattice is not isotropic
     and the nearest centre is not always the containing cell. */
  function squareAt(grid, lon, lat) {
    const { west, south, dlon, dlat } = grid.lattice;
    const nearCol = Math.round((lon - west) / dlon);
    let best = null;
    for (let col = nearCol - 1; col <= nearCol + 1; col++) {
      const nearRow = Math.round((lat - south) / dlat - rowOffset(col));
      for (let row = nearRow - 1; row <= nearRow + 1; row++) {
        if (!holds(grid, col, row)) continue;
        const centre = squareCentre(grid, { col, row });
        const dx = (lon - centre[0]) * grid.kx;
        const dy = lat - centre[1];
        const away = dx * dx + dy * dy;
        if (!best || away < best.away) best = { col, row, away };
      }
    }
    return best && { col: best.col, row: best.row };
  }

  function severityAt(grid, square) {
    const { col: col0, row: row0, rows } = grid.bounds;
    return grid.squares[(square.col - col0) * rows + (square.row - row0)];
  }

  /* u and v run 0 to 1 across the drawing. The projection is affine in longitude and in
     latitude, so these invert it exactly without carrying the scale factors. */
  function lonLatAt(grid, u, v) {
    const f = grid.frame;
    return [f.west + u * (f.east - f.west), f.north - v * (f.north - f.south)];
  }

  function imageOf(grid, lon, lat) {
    const f = grid.frame;
    return { u: (lon - f.west) / (f.east - f.west), v: (f.north - lat) / (f.north - f.south) };
  }

  const place = (lon, lat) =>
    `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ` + `${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;

  function readoutFor(grid, square) {
    const severity = severityAt(grid, square);
    if (severity === EMPTY) return null;
    const [lon, lat] = squareCentre(grid, square);
    return { label: grid.categories[severity], place: place(lon, lat), square };
  }

  function readoutAt(grid, u, v) {
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const square = squareAt(grid, ...lonLatAt(grid, u, v));
    return square && readoutFor(grid, square);
  }

  /* Squares a fixed distance out from a centre: the perimeter of a box, not its inside,
     so the rings a search walks never cover the same square twice. */
  function filledOnRing(grid, from, ring) {
    for (let col = from.col - ring; col <= from.col + ring; col++) {
      const onEdgeColumn = Math.abs(col - from.col) === ring;
      for (let row = from.row - ring; row <= from.row + ring; row++) {
        if (!onEdgeColumn && Math.abs(row - from.row) !== ring) continue;
        if (holds(grid, col, row) && severityAt(grid, { col, row }) !== EMPTY) return { col, row };
      }
    }
    return null;
  }

  /* The keyboard cursor has to land on a square that says something, and the grid is
     mostly empty at its corners. The reach is bounded so a grid with nothing in it
     returns rather than walking every square. */
  function nearestFilled(grid, from) {
    if (!from) return null;
    for (let ring = 0; ring < SEARCH_RINGS; ring++) {
      const found = filledOnRing(grid, from, ring);
      if (found) return found;
    }
    return null;
  }

  /* The drawing is translated and scaled inside a box that never shows a gap: at rest it
     fills the box exactly, and every zoom and pan is clamped back to covering it. That is
     what keeps the state framed however far in the reader goes. */
  function clampView(view, box) {
    const scale = Math.min(Math.max(view.scale, 1), MAX_ZOOM);
    return {
      scale,
      x: Math.min(0, Math.max(view.x, box.width - box.width * scale)),
      y: Math.min(0, Math.max(view.y, box.height - box.height * scale)),
    };
  }

  const viewToImage = (view, at, box) => ({
    u: (at.x - view.x) / view.scale / box.width,
    v: (at.y - view.y) / view.scale / box.height,
  });

  const imageToView = (view, uv, box) => ({
    x: uv.u * box.width * view.scale + view.x,
    y: uv.v * box.height * view.scale + view.y,
  });

  /* Returns the view unchanged when the step cannot move the scale. The wheel handler
     reads that as "this gesture is not a zoom" and lets the page have the scroll. */
  function zoomAt(view, at, step, box) {
    const scale = Math.min(Math.max(view.scale * step, 1), MAX_ZOOM);
    if (scale === view.scale) return view;
    const ratio = scale / view.scale;
    return clampView({ scale, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio }, box);
  }

  const api = {
    decodeGrid,
    filledSquares,
    squareAt,
    squareCentre,
    severityAt,
    lonLatAt,
    imageOf,
    readoutFor,
    readoutAt,
    nearestFilled,
    clampView,
    viewToImage,
    imageToView,
    zoomAt,
    EMPTY,
    MAX_ZOOM,
    ZOOM_STEP,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.hailMap = api;
})();
