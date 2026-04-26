/**
 * Team card canvases: same wireframe globe as the hero sea.
 * Paints from `registerGlobeMirrorPaint` — flushed once per sea RAF (no extra
 * per-card requestAnimationFrame loops).
 */

import { fitCanvas } from './canvas-utils.js';
import { drawWireframeParticleGlobe } from './wireframe-globe.js';
import {
  getHeroGlobeMirrorState,
  registerGlobeMirrorPaint,
} from './hero-globe-state.js';

export function mountGlobeMirror(canvas) {
  let ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) ctx = canvas.getContext('2d');

  let w = 0;
  let h = 0;
  let dpr = 1;
  let docVisible = true;
  let canvasOnScreen = true;

  function build() {
    ({ w, h, dpr } = fitCanvas(canvas));
  }

  function paint() {
    if (!docVisible || !canvasOnScreen) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const state = getHeroGlobeMirrorState();
    if (!state) return;

    const R = Math.min(w, h) * 0.38;
    drawWireframeParticleGlobe(
      ctx,
      w * 0.5,
      h * 0.5,
      R,
      state.spin,
      state.depth01,
      state.reduced,
      w,
      h,
      state.visGlobe
    );
  }

  const onVis = () => {
    docVisible = document.visibilityState === 'visible';
  };
  const onResize = () => build();

  const io = new IntersectionObserver(
    ([entry]) => {
      canvasOnScreen = entry.isIntersecting;
    },
    { threshold: 0 }
  );

  build();
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', onResize, { passive: true });
  io.observe(canvas);

  const unregister = registerGlobeMirrorPaint(paint);

  return () => {
    unregister();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
    io.disconnect();
  };
}
