/**
 * Atom-shaped particle field for View A.
 *
 * - A dense nucleus of shaded 3D spheres
 * - 3 elliptical orbits (hydrogen-style "energy circles")
 * - Electrons as small glowing spheres with trails
 */

import {
  createLoop,
  densityFor,
  fitCanvas,
  prefersReducedMotion,
} from './canvas-utils.js';
import { drawShadedSphere } from './sphere.js';

export function mountAtom(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = prefersReducedMotion();

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let radius = 0;

  let nucleus = [];
  let orbits = [];

  const lightMode = window.matchMedia('(prefers-color-scheme: light)').matches;
  const nucleusRgb = lightMode ? [10, 127, 191] : [120, 200, 255];
  const palette = lightMode
    ? {
        nucleusGlow: 'rgba(26, 166, 232, 0.55)',
        orbit: 'rgba(10, 127, 191, 0.18)',
        electronRgb: [10, 127, 191],
        trailRgb: [26, 166, 232],
      }
    : {
        nucleusGlow: 'rgba(76, 201, 255, 0.55)',
        orbit: 'rgba(76, 201, 255, 0.22)',
        electronRgb: [157, 220, 255],
        trailRgb: [76, 201, 255],
      };

  function build() {
    ({ w, h, dpr } = fitCanvas(canvas));
    cx = w / 2;
    cy = h / 2;
    radius = Math.min(w, h) * 0.36;

    const nucleusCount = densityFor(120, 60);
    nucleus = new Array(nucleusCount).fill(0).map(() => {
      let x;
      let y;
      let z;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      const r = radius * 0.18;
      return {
        x: x * r,
        y: y * r,
        z: z * r,
        size: 0.55 + Math.random() * 1.35,
        twinkle: Math.random() * Math.PI * 2,
      };
    });
    nucleus.sort((a, b) => a.z - b.z);

    const orbitDefs = [
      { tilt: 0, rx: 1.0, ry: 0.32, speed: 0.8, count: densityFor(2, 1) },
      { tilt: Math.PI / 3, rx: 1.0, ry: 0.32, speed: 0.65, count: densityFor(2, 1) },
      { tilt: -Math.PI / 3, rx: 1.0, ry: 0.32, speed: -0.55, count: densityFor(1, 1) },
    ];

    orbits = orbitDefs.map((o) => ({
      ...o,
      electrons: new Array(o.count).fill(0).map((_, i) => ({
        phase: (i / o.count) * Math.PI * 2 + Math.random() * 0.6,
        trail: [],
      })),
    }));
  }

  function drawNucleus(t) {
    const grad = ctx.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      radius * 0.32
    );
    grad.addColorStop(0, palette.nucleusGlow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (const p of nucleus) {
      const depth = (p.z + radius * 0.18) / (radius * 0.36);
      const tw = 0.6 + Math.sin(t * 0.003 + p.twinkle) * 0.4;
      const pr = p.size * (0.65 + depth * 0.65);
      const alpha = (0.45 + depth * 0.5) * tw * 0.92;
      const spec = 0.25 + depth * 0.35;
      drawShadedSphere(
        ctx,
        cx + p.x,
        cy + p.y,
        pr,
        nucleusRgb,
        alpha,
        spec
      );
    }
  }

  function drawOrbits(t, rot) {
    for (const o of orbits) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(o.tilt + rot);

      ctx.strokeStyle = palette.orbit;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * o.rx, radius * o.ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      for (const e of o.electrons) {
        const a = e.phase + (t * 0.001 * o.speed);
        const x = Math.cos(a) * radius * o.rx;
        const y = Math.sin(a) * radius * o.ry;

        e.trail.unshift({ x, y });
        if (e.trail.length > (reduced ? 1 : 14)) e.trail.pop();

        for (let i = 0; i < e.trail.length; i++) {
          const pt = e.trail[i];
          const k = 1 - i / e.trail.length;
          const tr = 2.8 * k + 0.5;
          drawShadedSphere(
            ctx,
            pt.x,
            pt.y,
            tr,
            palette.trailRgb,
            k * 0.32,
            k * 0.4
          );
        }

        drawShadedSphere(
          ctx,
          x,
          y,
          2.6,
          palette.electronRgb,
          1,
          0.95
        );
      }
      ctx.restore();
    }
  }

  function render(_dt, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const rot = reduced ? 0 : now * 0.00008;
    drawOrbits(now, rot);
    drawNucleus(now);
  }

  build();
  return createLoop({ canvas, render, onResize: build });
}
