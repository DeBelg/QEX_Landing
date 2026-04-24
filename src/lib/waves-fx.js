/**
 * **Global sea** — one fixed full-viewport canvas, one continuous wave field
 * in document space (scroll depth). No per-section seams.
 *
 * - Phase / sag use `docY = scrollY + viewportY` so the raster is a single
 *   scrollable “sheet” of waves.
 * - Mass + warp only while `#view-a` intersects the viewport; mass position
 *   follows view A in screen space.
 */

import {
  createLoop,
  fitCanvas,
  prefersReducedMotion,
} from './canvas-utils.js';
import { drawShadedSphere } from './sphere.js';

const TINTS = [
  [76, 201, 255],
  [120, 210, 245],
  [76, 220, 212],
  [200, 235, 255],
];

function scrollDepth01ForLanding(el) {
  const vh = window.innerHeight || 1;
  if (!el) return 0.45;
  const r = el.getBoundingClientRect();
  return Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
}

/**
 * Mass in **viewport** px, only valid when view A crosses the screen.
 * @returns {null | { cx, cy, R, strength, norm }}
 */
function landingMass(viewA, w, h, depth01) {
  if (!viewA) return null;
  const ar = viewA.getBoundingClientRect();
  const vh = window.innerHeight;
  if (ar.bottom <= 4 || ar.top >= vh - 4) return null;

  const cx = ar.left + ar.width * 0.5;
  const m = Math.min(ar.width, ar.height, Math.min(w, h));
  const cy = ar.top + ar.height * (0.26 + depth01 * 0.42);
  const R = Math.max(16, m * (0.125 - depth01 * 0.038));
  const strength = m * (0.22 + depth01 * 0.78);
  const norm = Math.min(w, h);
  return { cx, cy, R, strength, norm };
}

function applyMassWarp(px, py, grav) {
  if (!grav || grav.strength <= 0) return { px, py };
  const dx = grav.cx - px;
  const dy = grav.cy - py;
  const d = Math.hypot(dx, dy) + 28;
  const norm = grav.norm ?? 200;
  const pull =
    (grav.strength * (norm * 0.00011)) /
    (Math.pow(d / norm, 1.75) + 0.085);
  return {
    px: px + (dx / d) * pull,
    py: py + (dy / d) * pull,
  };
}

/**
 * @param {number} vx — viewport x
 * @param {number} vy — viewport y
 * @param {number} docY — document Y = scrollY + vy
 */
function seaField(vx, vy, t, w, h, grav, docY) {
  const k = 0.0056;
  const omega = 0.00088;
  const innerH = Math.max(480, window.innerHeight || 800);
  const theta = k * vx - omega * t + (docY * k * 0.15) / innerH;

  const main = Math.sin(theta);
  const tail = 0.078 * Math.sin(theta * 1.16 + 0.28);

  const depth = vy / h;
  const ampH = w * 0.078 * (0.58 + depth * 0.42);
  const horizontal = (main + tail) * ampH;

  const ampV = h * 0.022;
  const heave = main * ampV;

  const g = 0.055;
  const gravSag = g * h * Math.pow(depth, 1.75) * 0.058;

  const midX = w * 0.5;
  const lens =
    0.016 * w * Math.sin(depth * Math.PI) * ((vx - midX) / w);

  let px = vx + horizontal + lens;
  let py = vy + heave + gravSag;

  if (grav) {
    const wped = applyMassWarp(px, py, grav);
    px = wped.px;
    py = wped.py;
  }

  const crest = Math.max(0, main);

  return {
    px,
    py,
    crest,
    tint: TINTS[
      (Math.floor(vx * 0.018) + Math.floor(docY * 0.012)) % TINTS.length
    ],
  };
}

function drawMassFieldBackdrop(ctx, cx, cy, R, depth01, w, h) {
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 4.2);
  const a = 0.04 + depth01 * 0.1;
  g.addColorStop(0, `rgba(20, 70, 120, ${a * 1.2})`);
  g.addColorStop(0.35, `rgba(10, 40, 80, ${a * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSpinningMass(
  ctx,
  cx,
  cy,
  R,
  angle,
  depth01,
  reduced,
  w,
  h
) {
  drawMassFieldBackdrop(ctx, cx, cy, R, depth01, w, h);

  const coreRgb = [28, 98, 158];
  const alpha = 0.88 + depth01 * 0.1;
  const spec = 0.38 + (1 - depth01) * 0.42;
  drawShadedSphere(ctx, cx, cy, R, coreRgb, alpha, spec);

  if (reduced) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.992, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const lineA = 0.14 + (1 - depth01) * 0.12;
  ctx.strokeStyle = `rgba(180, 230, 255, ${lineA})`;
  ctx.lineWidth = 1.05;

  const meridians = 10;
  for (let i = 0; i < meridians; i++) {
    ctx.save();
    ctx.rotate((i / meridians) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.98);
    ctx.lineTo(0, R * 0.98);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = `rgba(120, 200, 255, ${0.08 + (1 - depth01) * 0.06})`;
  ctx.lineWidth = 0.65;
  for (let e = 0; e < 4; e++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, R * (0.28 + e * 0.18), R * 0.98, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = `rgba(140, 220, 255, ${0.18 + (1 - depth01) * 0.15})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 0.5, -0.4, Math.PI * 0.85);
  ctx.stroke();
}

/**
 * One continuous sea across the whole page scroll; mass only with view A.
 */
export function mountGlobalSea(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = prefersReducedMotion();

  let w = 0;
  let h = 0;
  let dpr = 1;

  let nHoriz = 6;
  let nVert = 7;
  let sampleDx = 3.5;
  let sampleDy = 4;

  function build() {
    ({ w, h, dpr } = fitCanvas(canvas));
    const narrow = w < 480;
    nHoriz = narrow ? 5 : 6;
    nVert = narrow ? 6 : 8;
    sampleDx = Math.max(2.8, Math.min(4.5, w / 175));
    sampleDy = Math.max(3.2, Math.min(5, h / 150));
  }

  function marginY() {
    return h * 0.08;
  }
  function marginX() {
    return w * 0.04;
  }

  function yRestForLine(i) {
    const m = marginY();
    const span = h - 2 * m;
    if (nHoriz <= 1) return h * 0.5;
    return m + (i / (nHoriz - 1)) * span;
  }

  function xRestForCol(j) {
    const m = marginX();
    const span = w - 2 * m;
    if (nVert <= 1) return w * 0.5;
    return m + (j / (nVert - 1)) * span;
  }

  function drawHorizontalLines(t, lineRgb, lineAlpha, lineWidth, grav, scrollY) {
    const [lr, lg, lb] = lineRgb;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${lineAlpha})`;

    for (let i = 0; i < nHoriz; i++) {
      const y0 = yRestForLine(i);
      const docY0 = scrollY + y0;
      ctx.beginPath();
      let first = true;
      for (let x = 0; x <= w + 0.5; x += sampleDx) {
        const s = seaField(x, y0, t, w, h, grav, docY0);
        if (first) {
          ctx.moveTo(s.px, s.py);
          first = false;
        } else {
          ctx.lineTo(s.px, s.py);
        }
      }
      ctx.stroke();
    }
  }

  function drawVerticalLines(t, lineRgb, lineAlpha, lineWidth, grav, scrollY) {
    const [lr, lg, lb] = lineRgb;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${lineAlpha * 0.85})`;

    for (let j = 0; j < nVert; j++) {
      const x0 = xRestForCol(j);
      ctx.beginPath();
      let first = true;
      for (let y = 0; y <= h + 0.5; y += sampleDy) {
        const docY = scrollY + y;
        const s = seaField(x0, y, t, w, h, grav, docY);
        if (first) {
          ctx.moveTo(s.px, s.py);
          first = false;
        } else {
          ctx.lineTo(s.px, s.py);
        }
      }
      ctx.stroke();
    }
  }

  function drawSparseNodes(t, sphereEvery, baseRad, grav, scrollY) {
    for (let i = 0; i < nHoriz; i++) {
      const y0 = yRestForLine(i);
      const docY0 = scrollY + y0;
      let step = 0;
      for (let x = 0; x <= w + 0.5; x += sampleDx) {
        const s = seaField(x, y0, t, w, h, grav, docY0);
        const draw =
          step % sphereEvery === 0 || s.crest > 0.72;
        step++;
        if (!draw) continue;

        const [tr, tg, tb] = s.tint;
        const cr = s.crest;
        const wr = Math.round(tr + (255 - tr) * cr * 0.52);
        const wg = Math.round(tg + (255 - tg) * cr * 0.52);
        const wb = Math.round(tb + (255 - tb) * cr * 0.52);
        const depth = y0 / h;
        const alpha = (0.34 + depth * 0.38) * (0.52 + cr * 0.48);
        const rad = baseRad + cr * 1.05;
        drawShadedSphere(ctx, s.px, s.py, rad, [wr, wg, wb], alpha, cr * 0.82);
      }
    }
  }

  function render(_dt, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const scrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;

    const viewA = document.getElementById('view-a');
    const depth01 = scrollDepth01ForLanding(viewA);
    const layout = landingMass(viewA, w, h, depth01);
    const grav = layout
      ? {
          cx: layout.cx,
          cy: layout.cy,
          strength: layout.strength,
          norm: layout.norm,
        }
      : null;

    const t = reduced ? 0 : now * 1;
    const lineRgb = [70, 178, 232];
    const lineAlpha = 0.26;
    const lineWidth = 1.05;

    drawHorizontalLines(t, lineRgb, lineAlpha, lineWidth, grav, scrollY);
    drawVerticalLines(
      t,
      lineRgb,
      lineAlpha * 0.82,
      lineWidth * 0.92,
      grav,
      scrollY
    );

    const sphereEvery = w < 520 ? 4 : 3;
    const baseRad = Math.max(1.25, sampleDx * 0.34);
    drawSparseNodes(t, sphereEvery, baseRad, grav, scrollY);

    if (layout) {
      const spin = reduced ? 0 : now * (0.00055 + depth01 * 0.00035);
      drawSpinningMass(
        ctx,
        layout.cx,
        layout.cy,
        layout.R,
        spin,
        depth01,
        reduced,
        w,
        h
      );
    }
  }

  build();
  return createLoop({ canvas, render, onResize: build });
}
