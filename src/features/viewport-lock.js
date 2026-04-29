/* ---------------------------------------------------------------------------
   Viewport height lock
   ---------------------------------------------------------------------------
   iOS Safari / Chrome-iOS animate their URL bar in and out during scroll, which
   changes `window.innerHeight` (and `dvh`/`svh`/`lvh`) mid-frame. Even with
   `min-height: 100lvh` we were still seeing the page reflow, because:
     - on first load the bar is visible (innerHeight ≈ smallest)
     - on first scroll the bar collapses (innerHeight grows)
     - subsequent up-scrolls bring the bar back (innerHeight shrinks)
   We want the layout to be locked once and never move after that. So we write
   `--app-h` on :root in pixels and only ever GROW it. The first time the bar
   collapses we capture the largest possible height; from that point on, every
   element sized with `var(--app-h)` is pinned and bar transitions can never
   reflow our content. Only `orientationchange` (real geometry change) resets.
   --------------------------------------------------------------------------- */

export function initViewportLock() {
  const root = document.documentElement;

  /**
   * Probe the **largest** viewport in pixels by reading a hidden `100lvh` div.
   * iOS Safari >= 15.4 / Chrome >= 108 resolve `lvh` to the bar-collapsed height
   * even when the bar is currently visible, so we capture the true max on the
   * first frame, before any scroll has happened. Falls back to innerHeight on
   * older browsers (where lvh is unsupported and the probe collapses to 0).
   */
  const measureMaxViewportHeight = () => {
    const innerH = window.innerHeight || 0;
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none;contain:strict;';
    (document.body || root).appendChild(probe);
    const lvh = probe.getBoundingClientRect().height;
    probe.remove();
    return Math.max(lvh || 0, innerH, 1);
  };

  let locked = measureMaxViewportHeight();
  root.style.setProperty('--app-h', `${locked}px`);

  /** Belt-and-braces: never let the lock shrink, only grow if we discover bigger. */
  const grow = () => {
    const next = measureMaxViewportHeight();
    if (next > locked + 1) {
      locked = next;
      root.style.setProperty('--app-h', `${locked}px`);
    }
  };

  /** Coalesce poll to one per RAF (cheap; no DOM reads outside the RAF). */
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      grow();
    });
  };

  window.addEventListener('scroll', schedule, { passive: true });

  /** Real geometry change - re-lock to the new orientation's max. */
  const relock = () => {
    locked = measureMaxViewportHeight();
    root.style.setProperty('--app-h', `${locked}px`);
  };

  /**
   * On a real resize (window-resize on desktop, rotation on mobile) the width
   * changes; bar-transition resizes only change the height, so we ignore those.
   */
  let lastW = window.innerWidth;
  window.addEventListener(
    'resize',
    () => {
      const w = window.innerWidth;
      if (Math.abs(w - lastW) > 4) {
        lastW = w;
        relock();
      }
    },
    { passive: true }
  );
  window.addEventListener('orientationchange', () => {
    setTimeout(relock, 250);
  });
}
