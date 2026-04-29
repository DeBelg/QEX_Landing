/**
 * Hero sphere spin model.
 * Combines scroll-driven roll with a subtle time-based idle spin.
 */
export function computeHeroSpin({ reduced, now, depth01, rollAngle }) {
  const idleSpin = reduced ? 0 : now * (0.00028 + depth01 * 0.00022);
  return rollAngle + idleSpin;
}
