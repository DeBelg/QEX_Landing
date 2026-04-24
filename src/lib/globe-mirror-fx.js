/**
 * Team card canvases: same wireframe globe as the hero sea, driven by one
 * per-frame snapshot from `mountGlobalSea` (no duplicate mass math).
 */

import { createLoop, fitCanvas } from './canvas-utils.js';
import { drawWireframeParticleGlobe } from './wireframe-globe.js';
import { getHeroGlobeMirrorState } from './hero-globe-state.js';

export function mountGlobeMirror(canvas) {
  const ctx = canvas.getContext('2d');

  let w = 0;
  let h = 0;
  let dpr = 1;

  function build() {
    ({ w, h, dpr } = fitCanvas(canvas));
  }

  function render() {
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

  build();
  return createLoop({ canvas, render, onResize: build });
}
