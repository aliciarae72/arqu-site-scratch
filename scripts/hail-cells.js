/* Source-ring geometry, kept out of what the page downloads: the browser is served the
   encoded grid and never sees a ring. CommonJS, because an ESM generator and a CommonJS
   test both have to read it. */

function boxOf(ring) {
  const lon = ring.map((p) => p[0]);
  const lat = ring.map((p) => p[1]);
  const west = Math.min(...lon);
  const east = Math.max(...lon);
  const south = Math.min(...lat);
  const north = Math.max(...lat);
  return { width: east - west, height: north - south, lon: (west + east) / 2, lat: (south + north) / 2 };
}

const inFrame = (frame, box) =>
  box.lon >= frame.west && box.lon <= frame.east && box.lat >= frame.south && box.lat <= frame.north;

/* The extract runs past the state line to the north and the south-west. The figure is
   Colorado, so a cell centred outside the frame is neither drawn nor counted; the ones that
   straddle the line are trimmed by the clip rather than dropped. */
const drawnCells = (frame, cells) => cells.filter(([, ring]) => inFrame(frame, boxOf(ring)));

module.exports = { boxOf, inFrame, drawnCells };
