/* The Programs chart's camera: it opens close on one dot and pulls back to the whole
   chart, once, when the chart first comes into view. */
(() => {
  const HOLD_MS = 1400;
  const ZOOM_MS = 3800;

  /* the frame of this aspect that holds a set of dots, with a margin */
  function frameAround(dots, margin, aspect) {
    const left = Math.min(...dots.map((d) => d.x - d.r));
    const right = Math.max(...dots.map((d) => d.x + d.r));
    const top = Math.min(...dots.map((d) => d.y - d.r));
    const bottom = Math.max(...dots.map((d) => d.y + d.r));
    const height = Math.max(bottom - top, (right - left) / aspect) * margin;
    return { cx: (left + right) / 2, cy: (top + bottom) / 2, width: height * aspect, height };
  }

  /* Size changes geometrically, so each moment of the pull-back feels the same speed. The
     anchor glides linearly from its place in `from` to its place in `to`, measured as a
     share of the frame, so it never leaves the frame on the way out. */
  function frameAt(progress, from, to, anchor) {
    const height = from.height * (to.height / from.height) ** progress;
    const width = (height * from.width) / from.height;
    const share = (frame, axis, size) => (anchor[axis] - frame[`c${axis}`]) / frame[size];
    const sx = share(from, 'x', 'width') + (share(to, 'x', 'width') - share(from, 'x', 'width')) * progress;
    const sy = share(from, 'y', 'height') + (share(to, 'y', 'height') - share(from, 'y', 'height')) * progress;
    return { cx: anchor.x - sx * width, cy: anchor.y - sy * height, width, height };
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  /* where the camera is at `elapsed` ms after the play starts: held, then pulling back */
  function progressAt(elapsed) {
    return easeInOut(Math.min(1, Math.max(0, (elapsed - HOLD_MS) / ZOOM_MS)));
  }

  /* Paints every frame of the pull-back, from 0 to 1, on the window's animation clock. */
  function play(win, paint) {
    const began = win.performance.now();
    const tick = (now) => {
      const progress = progressAt(now - began);
      paint(progress);
      if (progress < 1) win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
  }

  /* Runs `run` once, the first time half of `el` is on screen. */
  function onceHalfSeen(win, el, run) {
    const watch = new win.IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        watch.disconnect();
        run();
      },
      { threshold: 0.5 },
    );
    watch.observe(el);
  }

  const api = { frameAround, frameAt, progressAt, play, onceHalfSeen };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.arquBookCamera = api;
})();
