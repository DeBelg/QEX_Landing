import './styles/main.css';

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

(() => {
  const root = document.documentElement;

  /**
   * Probe the **largest** viewport in pixels by reading a hidden `100lvh` div.
   * iOS Safari ≥ 15.4 / Chrome ≥ 108 resolve `lvh` to the bar-collapsed height
   * even when the bar is currently visible — so we capture the true max on the
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

  /** Real geometry change — re-lock to the new orientation's max. */
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
})();

/* ---------------------------------------------------------------------------
   Footer year (sync, tiny)
   --------------------------------------------------------------------------- */

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

/* ---------------------------------------------------------------------------
   View reveal — toggle .is-visible when each section enters the viewport.
   --------------------------------------------------------------------------- */

const viewObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        viewObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.18 }
);
document.querySelectorAll('.view').forEach((v) => viewObserver.observe(v));

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

/** Wait for first paint before loading animation + canvas work. */
function afterFirstPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

afterFirstPaint(async () => {
  const [{ mountGlobalSea }, animeMod] = await Promise.all([
    import('./lib/waves-fx.js'),
    import('animejs'),
  ]);
  const anime = animeMod.default;

  const globalSea = document.getElementById('global-sea');
  if (globalSea) {
    mountGlobalSea(globalSea);
  }

  /* Team card globes: mount only when the team block is near the viewport. */
  const teamSection = document.getElementById('view-d');
  let teamMirrorsMounted = false;
  const mountTeamMirrors = async () => {
    if (teamMirrorsMounted) return;
    teamMirrorsMounted = true;
    const { mountGlobeMirror } = await import('./lib/globe-mirror-fx.js');
    document.querySelectorAll('[data-fx="globe"]').forEach((el) => {
      mountGlobeMirror(el);
    });
  };

  if (teamSection) {
    const teamIo = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void mountTeamMirrors();
          teamIo.disconnect();
        }
      },
      { rootMargin: '120px 0px', threshold: 0 }
    );
    teamIo.observe(teamSection);
  }

  /* Catcher — motion without hiding text from LCP (no opacity keyframes). */
  if (!reducedMotion) {
    anime
      .timeline({ easing: 'easeOutExpo' })
      .add({
        targets: '.catcher__brand',
        translateY: [24, 0],
        letterSpacing: ['-0.02em', '-0.04em'],
        duration: 1100,
      })
      .add(
        {
          targets: '.catcher__tagline',
          translateY: [10, 0],
          duration: 600,
        },
        '-=500'
      );
  }

  /* Subscribe form — needs anime when user interacts. */
  const form = document.querySelector('[data-subscribe]');
  if (form) {
    const input = form.querySelector('.subscribe__input');
    const msg = form.querySelector('[data-subscribe-msg]');

    const setMsg = (text, state = '') => {
      msg.textContent = text;
      if (state) msg.dataset.state = state;
      else msg.removeAttribute('data-state');
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = (input.value || '').trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

      if (!valid) {
        setMsg('Please enter a valid email address.', 'error');
        if (!reducedMotion) {
          anime({
            targets: input,
            translateX: [
              { value: -8, duration: 60 },
              { value: 8, duration: 60 },
              { value: -5, duration: 60 },
              { value: 0, duration: 60 },
            ],
            easing: 'easeInOutQuad',
          });
        }
        return;
      }

      setMsg('Thanks — you\u2019re on the list.');
      input.value = '';
      if (!reducedMotion) {
        anime({
          targets: form.querySelector('.subscribe__btn'),
          scale: [
            { value: 0.96, duration: 120 },
            { value: 1, duration: 220 },
          ],
          easing: 'easeOutBack',
        });
      }
    });
  }
});
