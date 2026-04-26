/**
 * Per-frame draw state for the hero wireframe globe, mirrored on team cards.
 * Written only from `mountGlobalSea` render — readers must not mutate.
 *
 * Team mirrors register paint callbacks; `mountGlobalSea` calls
 * `flushGlobeMirrorRenders()` once per frame so one RAF drives sea + mirrors.
 */

/** @type {null | { spin: number, depth01: number, visGlobe: number, reduced: boolean }} */
let mirror = null;

/** @type {Set<() => void>} */
const mirrorPainters = new Set();

export function setHeroGlobeMirrorState(next) {
  mirror = next;
}

export function getHeroGlobeMirrorState() {
  return mirror;
}

/** @returns {() => void} unsubscribe */
export function registerGlobeMirrorPaint(fn) {
  mirrorPainters.add(fn);
  return () => mirrorPainters.delete(fn);
}

export function flushGlobeMirrorRenders() {
  for (const fn of mirrorPainters) fn();
}
