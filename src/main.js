import './styles/main.css';

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
      )
      .add(
        {
          targets: '.catcher__scroll',
          opacity: [0, 0.55],
          duration: 600,
        },
        '-=300'
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
