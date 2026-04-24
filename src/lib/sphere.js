/**
 * Draw a small 3D-looking sphere (radial gradient + specular highlight).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x center (CSS px)
 * @param {number} y center (CSS px)
 * @param {number} radius outer radius
 * @param {[number, number, number]} rgb base tint 0–255
 * @param {number} alpha 0–1 overall opacity
 * @param {number} specular 0–1 extra highlight (crests / electrons)
 */
export function drawShadedSphere(ctx, x, y, radius, rgb, alpha = 1, specular = 0) {
  if (radius <= 0.05) return;
  const [r, g, b] = rgb;
  const hx = x - radius * 0.38;
  const hy = y - radius * 0.38;
  const grd = ctx.createRadialGradient(hx, hy, radius * 0.1, x, y, radius);

  const spec = specular * 78;
  const hiR = Math.min(255, r + 58 + spec);
  const hiG = Math.min(255, g + 58 + spec);
  const hiB = Math.min(255, b + 72 + spec);
  const midR = Math.min(255, r + 20 + spec * 0.35);
  const midG = Math.min(255, g + 20 + spec * 0.35);
  const midB = Math.min(255, b + 16 + spec * 0.35);
  const loR = Math.max(0, Math.round(r * 0.28));
  const loG = Math.max(0, Math.round(g * 0.28));
  const loB = Math.max(0, Math.round(b * 0.42));

  grd.addColorStop(0, `rgba(${hiR}, ${hiG}, ${hiB}, ${alpha})`);
  grd.addColorStop(0.4, `rgba(${midR}, ${midG}, ${midB}, ${alpha})`);
  grd.addColorStop(1, `rgba(${loR}, ${loG}, ${loB}, ${alpha * 0.9})`);

  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
