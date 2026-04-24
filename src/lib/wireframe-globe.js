/**
 * Shared wireframe + particle globe (hero + mirrored team canvases).
 */

function drawMassFieldBackdrop(ctx, cx, cy, R, depth01, w, h) {
  const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 5.2);
  const a = 0.09 + depth01 * 0.16;
  g.addColorStop(0, `rgba(55, 150, 215, ${a * 1.15})`);
  g.addColorStop(0.28, `rgba(25, 95, 155, ${a * 0.72})`);
  g.addColorStop(0.55, `rgba(12, 50, 95, ${a * 0.35})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Mass as a **wireframe + particle** globe: lat/long arcs, extra great circles,
 * and shaded vertex dots (no solid gradient sphere).
 */
export function drawWireframeParticleGlobe(
  ctx,
  cx,
  cy,
  R,
  angle,
  depth01,
  reduced,
  w,
  h,
  visFade
) {
  const vf = Math.max(0, Math.min(1, visFade));
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.2 + vf * 0.95);

  drawMassFieldBackdrop(ctx, cx, cy, R, depth01, w, h);

  const latN = 12;
  const lonN = 20;
  const persp = 0.0025;
  const latRows = latN + 1;

  function rotateY(x, y, z, a) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    return {
      x: x * ca + z * sa,
      y,
      z: -x * sa + z * ca,
    };
  }

  function project(x, y, z) {
    const sc = 1 / (1 + z * persp);
    return {
      sx: cx + x * sc,
      sy: cy - y * sc,
      z,
      sc,
    };
  }

  const raw = [];
  for (let la = 0; la < latRows; la++) {
    const phi = (la / latN - 0.5) * Math.PI;
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    for (let lo = 0; lo < lonN; lo++) {
      const theta = (lo / lonN) * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const x = R * cp * ct;
      const y = R * sp;
      const z = R * cp * st;
      const p = rotateY(x, y, z, reduced ? 0 : angle);
      raw.push(project(p.x, p.y, p.z));
    }
  }

  const lineBaseA = 0.2 + (1 - depth01) * 0.14;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.15;

  for (let la = 0; la < latRows; la++) {
    ctx.beginPath();
    for (let lo = 0; lo <= lonN; lo++) {
      const loM = lo % lonN;
      const p = raw[la * lonN + loM];
      if (lo === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    const fa = 0.45 + (la / latN) * 0.55;
    ctx.strokeStyle = `rgba(165, 225, 255, ${lineBaseA * fa})`;
    ctx.stroke();
  }

  for (let lo = 0; lo < lonN; lo++) {
    ctx.beginPath();
    for (let la = 0; la < latRows; la++) {
      const p = raw[la * lonN + lo];
      if (la === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    const fa = 0.5 + (lo / lonN) * 0.5;
    ctx.strokeStyle = `rgba(140, 215, 255, ${lineBaseA * fa})`;
    ctx.stroke();
  }

  const tiltCount = 6;
  const steps = 56;
  ctx.lineWidth = 0.75;
  for (let ti = 0; ti < tiltCount; ti++) {
    const tilt = (ti / tiltCount) * Math.PI;
    const roll = ti * 1.17 + angle * 0.5;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const u = (s / steps) * Math.PI * 2;
      const x = R * Math.cos(u) * Math.cos(tilt);
      const y = R * Math.sin(u);
      const z = R * Math.cos(u) * Math.sin(tilt);
      const p0 = rotateY(x, y, z, roll);
      const pr = project(p0.x, p0.y, p0.z);
      if (s === 0) ctx.moveTo(pr.sx, pr.sy);
      else ctx.lineTo(pr.sx, pr.sy);
    }
    const fa = 0.45 + 0.35 * Math.sin(ti + depth01);
    ctx.strokeStyle = `rgba(130, 210, 255, ${0.1 + fa * 0.14})`;
    ctx.stroke();
  }

  const lx = 0.45;
  const ly = -0.75;
  const lz = 0.35;
  const lLen = Math.hypot(lx, ly, lz) || 1;

  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const nx = p.sx - cx;
    const ny = -(p.sy - cy);
    const nz = p.z;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    const ndotl = Math.max(
      0,
      (nx * lx + ny * ly + nz * lz) / (nLen * lLen)
    );
    const cool = 0.2 + ndotl * 0.8;
    const br = Math.round(90 + cool * 145);
    const bg = Math.round(170 + cool * 80);
    const bb = Math.round(225 + cool * 35);
    const pr = 0.75 + ((p.z + R) / (2 * R)) * 1.65;
    const dotA =
      (0.35 + ndotl * 0.5) * (0.58 + ((p.z + R) / (2 * R)) * 0.5);
    ctx.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${dotA})`;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, pr * 0.52, 0, Math.PI * 2);
    ctx.fill();
    if (ndotl > 0.45) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + 0.2 * ndotl})`;
      ctx.beginPath();
      ctx.arc(p.sx - pr * 0.14, p.sy - pr * 0.14, pr * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = `rgba(220, 245, 255, ${0.28 + (1 - depth01) * 0.18})`;
  ctx.lineWidth = 1.45;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 1.6, -0.35, Math.PI * 0.82);
  ctx.stroke();
  ctx.strokeStyle = `rgba(100, 190, 255, ${0.12})`;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 3.2, 0.2, Math.PI * 1.1);
  ctx.stroke();

  ctx.restore();
}
