/**
 * Shared helpers for the canvas-driven backgrounds.
 * Mobile-first: particle counts, DPR, and FPS targets are tuned conservatively.
 */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

/**
 * Scale density gracefully on small screens so phones stay smooth.
 * @param {number} base desktop target
 * @param {number} mobile mobile floor
 */
export function densityFor(base, mobile) {
  if (typeof window === 'undefined') return base;
  const w = window.innerWidth;
  if (w < 480) return mobile;
  if (w < 900) return Math.round((base + mobile) / 2);
  return base;
}

/**
 * Resize a canvas to its layout size. DPR capped for perf (phones: use maxDpr 1).
 * Returns { w, h, dpr } in CSS pixels (w/h) and device pixels via dpr.
 * @param {{ maxDpr?: number }} [options]
 */
export function fitCanvas(canvas, options = {}) {
  const maxDpr = options.maxDpr ?? 2;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  return { w, h, dpr };
}

/**
 * Lightweight RAF loop with visibility + `IntersectionObserver` gating so
 * off-screen canvases don't cost anything.
 *
 * Team globe mirrors piggyback the global sea frame via
 * `flushGlobeMirrorRenders` instead of each starting its own RAF.
 *
 * @param {object} cfg
 * @param {HTMLCanvasElement} cfg.canvas
 * @param {(dt: number, now: number) => void} cfg.render
 * @param {() => void} [cfg.onResize]
 * @param {boolean} [cfg.alwaysOnScreen=false] — Skip the IntersectionObserver
 *   gate. Use for fixed/full-viewport backgrounds (the global sea), where iOS
 *   Safari can flap `isIntersecting=false` during inertial scroll / address-bar
 *   transitions, freezing the canvas mid-frame and producing a "particles
 *   stopped, then switched" jump.
 * @param {number} [cfg.targetFps=120] — Upper bound on render rate. RAF naturally
 *   caps at the device refresh (60 Hz on most laptops, 120 Hz on iPhone 15 Pro
 *   Max ProMotion, 240 Hz on some monitors); this clamp ensures we never draw
 *   faster than the iPhone 15 Pro Max ceiling, while still hitting full
 *   ProMotion 120 Hz on devices that support it.
 */
export function createLoop({
  canvas,
  render,
  onResize,
  alwaysOnScreen = false,
  targetFps = 120,
}) {
  let raf = 0;
  let last = performance.now();
  let lastDraw = -Infinity;
  let visible = true;
  let onScreen = true;
  const reduced = prefersReducedMotion();
  const minFrameMs = 1000 / Math.max(1, targetFps);

  const runFrame = (now) => {
    const dt = Math.min(48, now - last);
    last = now;
    lastDraw = now;
    if (visible && onScreen) render(dt, now);
  };

  const handleResize = () => {
    onResize?.();
    runFrame(performance.now());
  };
  window.addEventListener('resize', handleResize, { passive: true });

  const onVisibility = () => {
    visible = document.visibilityState === 'visible';
    last = performance.now();
    if (visible && onScreen) runFrame(performance.now());
  };
  document.addEventListener('visibilitychange', onVisibility);

  /** @type {IntersectionObserver | null} */
  let io = null;
  if (!alwaysOnScreen) {
    io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        last = performance.now();
        if (visible && onScreen) runFrame(performance.now());
      },
      { threshold: 0 }
    );
    io.observe(canvas);
  }

  /** Coalesce scroll to one draw per frame (reduced-motion path). */
  let scrollRaf = 0;
  const onScroll = () => {
    if (!visible || !onScreen) return;
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      runFrame(performance.now());
    });
  };

  if (reduced) {
    runFrame(performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
    };
  }

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    /** Frame-rate clamp: drop frames over `targetFps` (e.g. 240 Hz monitors → 120). */
    if (now - lastDraw + 0.5 < minFrameMs) return;
    runFrame(now);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('visibilitychange', onVisibility);
    io?.disconnect();
  };
}
