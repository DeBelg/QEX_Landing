/**
 * Tiny atom illustration for the Team cards in View D.
 * Nucleus + orbit electrons drawn as shaded spheres.
 */

import {
  createLoop,
  fitCanvas,
  prefersReducedMotion,
} from './canvas-utils.js';
import { drawShadedSphere } from './sphere.js';

export function mountElectron(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = prefersReducedMotion();

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let r = 0;

  const seed = Math.random();
  const orbits = [
    { tilt: seed * Math.PI, speed: 1.1 },
    { tilt: seed * Math.PI + Math.PI / 2.3, speed: -0.85 },
  ];

  const nucleusRgb = [140, 210, 255];
  const electronRgb = [76, 201, 255];
  const trailRgb = [100, 190, 255];

  function build() {
    ({ w, h, dpr } = fitCanvas(canvas));
    cx = w / 2;
    cy = h / 2;
    r = Math.min(w, h) * 0.42;
  }

  function render(_dt, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
    glow.addColorStop(0, 'rgba(76, 201, 255, 0.5)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    drawShadedSphere(ctx, cx, cy, 2.4, nucleusRgb, 0.98, 0.55);

    for (const o of orbits) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(o.tilt);

      ctx.strokeStyle = 'rgba(76, 201, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();

      const a = (reduced ? 0 : now * 0.001) * o.speed;
      const ex = Math.cos(a) * r;
      const ey = Math.sin(a) * r * 0.32;

      drawShadedSphere(ctx, ex, ey, 3.4, trailRgb, 0.45, 0.5);
      drawShadedSphere(ctx, ex, ey, 1.8, electronRgb, 1, 0.9);

      ctx.restore();
    }
  }

  build();
  return createLoop({ canvas, render, onResize: build });
}
