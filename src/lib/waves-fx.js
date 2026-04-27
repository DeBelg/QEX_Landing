/**
 * **Global sea** — one fixed full-viewport canvas, one continuous wave field
 * in document space (scroll depth).
 *
 * Mesh sampling **overscans** past the viewport so crests / warps never pull
 * the surface inward enough to expose empty black at the edges.
 *
 * **Perf roadmap (same look, faster):** (1) One RAF path — team globe mirrors
 * flush after this render (see `flushGlobeMirrorRenders`). (2) Next wins:
 * pre-bake bead sprites to atlas + `drawImage` instead of per-bead gradients;
 * optional `OffscreenCanvas` + Worker for sea mesh only, transfer to main;
 * long-term WebGL mesh shader matching current stroke+tint math for GPU-bound
 * phones while keeping layout/scroll contract identical.
 */

import {
  createLoop,
  fitCanvas,
  prefersReducedMotion,
} from './canvas-utils.js';
import { drawShadedSphere } from './sphere.js';
import { drawWireframeParticleGlobe } from './wireframe-globe.js';
import {
  flushGlobeMirrorRenders,
  setHeroGlobeMirrorState,
} from './hero-globe-state.js';

const TINTS = [
  [76, 201, 255],
  [120, 210, 245],
  [76, 220, 212],
  [200, 235, 255],
];

function scrollDepth01ForLanding(el, vh) {
  if (!el) return 0.45;
  const r = el.getBoundingClientRect();
  return Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
}

/**
 * Fraction of view A’s height that intersects the viewport (0 = off-screen).
 * Uses the **locked** canvas height (`vh` arg) instead of `window.innerHeight`
 * so iOS URL-bar transitions can't wiggle the visibility math each frame.
 */
function viewAViewportFraction(el, vh) {
  if (!el) return 0;
  const ar = el.getBoundingClientRect();
  const visTop = Math.max(0, ar.top);
  const visBot = Math.min(vh, ar.bottom);
  const visH = Math.max(0, visBot - visTop);
  return Math.min(1, visH / Math.max(8, ar.height));
}

/** Smoothstep: zero 1st derivative at 0 and 1 — avoids a linear “kink” in warp fade. */
function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Normalized document scroll 0 = top, 1 = bottom (max scroll depth).
 * Takes the locked canvas height (`vh`) so the scroll progress doesn't shift
 * subtly when iOS Safari's URL bar collapses (which would change innerHeight).
 */
function docScrollT(scrollY, vh) {
  const doc = document.documentElement;
  const scrollMax = Math.max(1, doc.scrollHeight - vh);
  const t = Math.max(0, Math.min(1, scrollY / scrollMax));
  return { scrollT: t, scrollMax };
}

/**
 * Ease that accelerates like gravity: slow at surface, faster mid descent.
 */
function sinkEase01(t) {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 1.72);
}

/**
 * Mass pose + warp. Scroll drives a long sink through the viewport (ball in a sea)
 * plus lateral drift; roll angle follows distance scrolled.
 * `visGlobe` stays strong through the journey, then tapers near max depth.
 * @returns {null | { cx, cy, R, strength, norm, vis, visGlobe, warpFade, driftX, scrollT, rollAngle }}
 */
function landingMass(viewA, w, h, depth01, scrollY, scrollT) {
  if (!viewA) return null;
  const ar = viewA.getBoundingClientRect();
  /** Use the locked canvas height as the "viewport" size — see CSS --app-h. */
  const vh = h;
  const vis = viewAViewportFraction(viewA, vh);
  const sinkProgress = sinkEase01(scrollT);

  /** Hero at rest: treat globe as fully visible even if `vis` is 0 on first layout frames. */
  const sectionBottomOk = ar.bottom > vh * 0.22;
  /** Before first layout, rects are often 0×0 — `bottom` is then 0 and would suppress the globe. */
  const atTopAwaitingLayout =
    scrollY < 2 && ar.top < vh * 0.98 && ar.height < 32;
  const topBoost =
    scrollY < 160 && (sectionBottomOk || atTopAwaitingLayout) ? 1 : 0;
  /** Keep globe visible while it “sinks” through the page, not only when #view-a intersects. */
  const sinkingViz = scrollT > 0.004 ? 0.7 : 0;
  const rawGlobe = Math.min(1, Math.max(vis, topBoost, sinkingViz));
  const tailFade =
    scrollT <= 0.88 ? 1 : Math.max(0, 1 - (scrollT - 0.88) / 0.12);
  const visGlobe = rawGlobe * tailFade;

  /**
   * Warp fade now tracks `visGlobe` directly. The previous formula
   * (`smoothstep01(vis) + scrollT * 0.88`) dipped to ~0.18 right where view-a
   * hands off to view-b (vis already ~0, scrollT only ~0.2), so the sea
   * visibly "settled" mid-page and re-warped — that was the unsmooth
   * screen-1 → screen-2 transition. Following `visGlobe` instead gives a
   * monotonic 1 → 0.7 → 0 ramp that mirrors the sphere's own visibility, so
   * the sea calms down only as the sphere itself fades out.
   */
  const warpFade = visGlobe;

  const m = Math.min(ar.width, ar.height, Math.min(w, h));
  const narrow = w < 560;
  const R = Math.max(
    22,
    m * (0.175 - depth01 * 0.048) * (1 - sinkProgress * 0.06)
  );

  /** Viewport: start on the vertical centerline, vertically centered; sink toward bottom with scroll. */
  const padY = R + 18;
  const startY = h * 0.5;
  const endY = Math.max(startY + 40, h - padY - 10);
  let cy = startY + (endY - startY) * sinkProgress;

  const ampX = narrow
    ? Math.min(40, Math.max(80, ar.width) * 0.11)
    : Math.min(120, Math.max(160, ar.width) * 0.19);
  const driftDamp = 1 - sinkProgress * 0.45;
  const driftX = Math.sin(scrollY * 0.00235 + 0.4) * ampX * driftDamp;

  const pad = R + 14;
  let cx = w * 0.5 + driftX;
  cx = Math.max(pad, Math.min(w - pad, cx));
  cy = Math.max(padY, Math.min(h - padY, cy));

  /** Roll as if contact with the sea: radians ~ arc length / radius. */
  const rollAngle = scrollY * (2.15 / Math.max(R, 24));

  const baseStrength = m * (0.22 + depth01 * 0.78);
  const strength = baseStrength * warpFade;
  const norm = Math.min(w, h);
  return {
    cx,
    cy,
    R,
    strength,
    norm,
    vis,
    visGlobe,
    warpFade,
    driftX,
    scrollT,
    rollAngle,
  };
}

function syncHeroTextSide(viewA, layout) {
  if (!viewA) return;
  if (!layout || layout.visGlobe < 0.03 || layout.scrollT > 0.12) {
    viewA.dataset.textSide = 'center';
    return;
  }
  const t = layout.driftX > 12 ? 'left' : layout.driftX < -12 ? 'right' : 'center';
  viewA.dataset.textSide = t;
}

/**
 * Fade the catcher copy out as view-a leaves the viewport so the hand-off into
 * view-b's fade-in is symmetric. CSS reads `--catcher-fade` (see main.css).
 * Uses `vis` directly: full opacity until view-a is ~70 % visible, then ramps
 * to 0 as it leaves — the catcher dissolves in step with the sphere sinking.
 */
function syncCatcherFade(viewA, layout) {
  if (!viewA) return;
  const vis = layout ? layout.vis : 1;
  /** Hold opacity 1 until view-a is half off-screen, then ease to 0. */
  const t = Math.max(0, Math.min(1, (vis - 0.18) / 0.5));
  const op = smoothstep01(t);
  /** Avoid CSSOM churn: only write when the value actually changes. */
  const next = op.toFixed(3);
  if (viewA.dataset.fade !== next) {
    viewA.dataset.fade = next;
    viewA.style.setProperty('--catcher-fade', next);
  }
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

/** Extra horizontal / vertical sampling margin so displaced waves never uncover black. */
function overscanPad(w, h, grav) {
  const ampEst = w * 0.09 + h * 0.035;
  const warpEst = grav ? Math.min(w, h) * 0.08 : 0;
  const pad = ampEst + warpEst + 48;
  return { padX: pad, padY: pad * 0.85 };
}

/** Depth 0..1 for amplitude shaping; clamp when sampling outside viewport band. */
function depthForSample(vy, h) {
  if (vy <= 0) return 0;
  if (vy >= h) return 1;
  return vy / h;
}

/**
 * @param {number} vx — viewport x (may be outside 0..w when overscanning)
 * @param {number} vy — viewport y
 * @param {number} docY — document Y = scrollY + vy
 */
function seaField(vx, vy, t, w, h, grav, docY) {
  const k = 0.0056;
  const omega = 0.00088;
  /** Use the locked canvas height (h) so the wave phase doesn't drift during
      iOS URL-bar transitions. */
  const innerH = Math.max(480, h);
  const theta = k * vx - omega * t + (docY * k * 0.15) / innerH;

  const main = Math.sin(theta);
  const tail = 0.078 * Math.sin(theta * 1.16 + 0.28);

  const depth = depthForSample(vy, h);
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

  const tintRaw =
    Math.floor(vx * 0.018) + Math.floor(docY * 0.012);
  const tintIdx =
    ((tintRaw % TINTS.length) + TINTS.length) % TINTS.length;

  return {
    px,
    py,
    crest,
    tint: TINTS[tintIdx],
  };
}

export function mountGlobalSea(canvas) {
  let ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) ctx = canvas.getContext('2d');
  const reduced = prefersReducedMotion();

  let w = 0;
  let h = 0;
  let dpr = 1;

  let nHoriz = 9;
  let nVert = 12;
  let sampleDx = 3.5;
  let sampleDy = 4;

  function build() {
    ({ w, h, dpr } = fitCanvas(canvas));
    const narrow = w < 480;
    /** Mobile flow: fewer lines + sparser dots → more whitespace, less visual chatter. */
    nHoriz = narrow ? 6 : 9;
    nVert = narrow ? 7 : 12;
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

  function drawHorizontalLines(
    t,
    lineRgb,
    lineAlpha,
    lineWidth,
    grav,
    scrollY,
    padX
  ) {
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
      for (let x = -padX; x <= w + padX + 0.5; x += sampleDx) {
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

  function drawVerticalLines(
    t,
    lineRgb,
    lineAlpha,
    lineWidth,
    grav,
    scrollY,
    padY
  ) {
    const [lr, lg, lb] = lineRgb;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${lineAlpha * 0.85})`;

    for (let j = 0; j < nVert; j++) {
      const x0 = xRestForCol(j);
      ctx.beginPath();
      let first = true;
      for (let y = -padY; y <= h + padY + 0.5; y += sampleDy) {
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

  function drawSparseNodes(
    t,
    sphereEvery,
    baseRad,
    grav,
    scrollY,
    padX
  ) {
    for (let i = 0; i < nHoriz; i++) {
      const y0 = yRestForLine(i);
      const docY0 = scrollY + y0;
      let step = 0;
      for (let x = -padX; x <= w + padX + 0.5; x += sampleDx) {
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
        const depth = depthForSample(y0, h);
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
    const depth01 = scrollDepth01ForLanding(viewA, h);
    const { scrollT } = docScrollT(scrollY, h);
    const layout = landingMass(viewA, w, h, depth01, scrollY, scrollT);
    syncHeroTextSide(viewA, layout);
    syncCatcherFade(viewA, layout);
    const grav =
      layout && layout.strength > 1e-4
        ? {
            cx: layout.cx,
            cy: layout.cy,
            strength: layout.strength,
            norm: layout.norm,
          }
        : null;

    const { padX, padY } = overscanPad(w, h, grav);

    const t = reduced ? 0 : now * 1;
    const lineRgb = [70, 178, 232];
    const lineAlpha = 0.26;
    const lineWidth = 1.05;

    drawHorizontalLines(t, lineRgb, lineAlpha, lineWidth, grav, scrollY, padX);
    drawVerticalLines(
      t,
      lineRgb,
      lineAlpha * 0.82,
      lineWidth * 0.92,
      grav,
      scrollY,
      padY
    );

    /** Mobile node stride bumped from 4 → 6 so the bead row reads as scattered, not solid. */
    const sphereEvery = w < 520 ? 6 : 3;
    const baseRad = Math.max(1.25, sampleDx * 0.34);
    drawSparseNodes(t, sphereEvery, baseRad, grav, scrollY, padX);

    if (layout && layout.visGlobe > 0.004) {
      const idleSpin = reduced ? 0 : now * (0.00028 + depth01 * 0.00022);
      const spin = layout.rollAngle + idleSpin;
      setHeroGlobeMirrorState({
        spin,
        depth01,
        visGlobe: layout.visGlobe,
        reduced,
      });
      /**
       * Particle dots are pixel-sized; without scaling they look ~3× chunkier
       * on the mobile hero (R≈65) than on desktop (R≈189). Scale dots with R
       * so the wireframe stays as airy on small screens. Capped at 1 so the
       * desktop look (calibrated for R≈190) is preserved exactly.
       */
      const heroDotScale = Math.max(0.45, Math.min(1, layout.R / 130));
      /**
       * On small/mobile heroes, draw the great-circle "aerial" arcs at 1.5× the
       * sphere radius so they extend past the sphere edge and read as orbits
       * instead of melting into the wireframe. Desktop keeps the spherical 1.0.
       */
      const heroTiltRScale = layout.R < 80 ? 1.5 : 1;
      drawWireframeParticleGlobe(
        ctx,
        layout.cx,
        layout.cy,
        layout.R,
        spin,
        depth01,
        reduced,
        w,
        h,
        layout.visGlobe,
        { dotScale: heroDotScale, tiltRScale: heroTiltRScale }
      );
    } else {
      setHeroGlobeMirrorState(null);
    }

    flushGlobeMirrorRenders();
  }

  build();
  return createLoop({
    canvas,
    render,
    onResize: build,
    /** Fixed full-viewport background — bypass the IO gate so iOS Safari's
        scroll-time `isIntersecting=false` flap can't freeze the simulation. */
    alwaysOnScreen: true,
    /** Render up to ProMotion 120 Hz; throttles 240 Hz monitors down to 120. */
    targetFps: 120,
  });
}
