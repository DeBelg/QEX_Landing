/**
 * Per-frame draw state for the hero wireframe globe, mirrored on team cards.
 * Written only from `mountGlobalSea` render — readers must not mutate.
 */

/** @type {null | { spin: number, depth01: number, visGlobe: number, reduced: boolean }} */
let mirror = null;

export function setHeroGlobeMirrorState(next) {
  mirror = next;
}

export function getHeroGlobeMirrorState() {
  return mirror;
}
