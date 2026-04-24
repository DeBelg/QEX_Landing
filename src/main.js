import anime from 'animejs';

import { mountGlobalSea } from './lib/waves-fx.js';
import { mountGlobeMirror } from './lib/globe-mirror-fx.js';

/* ---------------------------------------------------------------------------
   Footer year
   --------------------------------------------------------------------------- */

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

/* ---------------------------------------------------------------------------
   One full-viewport sea (#global-sea) + team card globes (mirror hero state).
   --------------------------------------------------------------------------- */

const globalSea = document.getElementById('global-sea');
if (globalSea) {
  mountGlobalSea(globalSea);
}

document.querySelectorAll('[data-fx="globe"]').forEach((el) => {
  mountGlobeMirror(el);
});

/* ---------------------------------------------------------------------------
   View reveal — toggle .is-visible when each section enters the viewport.
   The CSS handles the staggered fade-in.
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

/* ---------------------------------------------------------------------------
   Catcher (View A) hero animation — anime.js handles the brand entrance.
   --------------------------------------------------------------------------- */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduced) {
  anime
    .timeline({ easing: 'easeOutExpo' })
    .add({
      targets: '.catcher__brand',
      opacity: [0, 1],
      translateY: [24, 0],
      letterSpacing: ['-0.02em', '-0.04em'],
      duration: 1100,
    })
    .add(
      {
        targets: '.catcher__sub',
        opacity: [0, 0.75],
        translateY: [12, 0],
        duration: 700,
      },
      '-=700'
    )
    .add(
      {
        targets: '.catcher__tagline',
        opacity: [0, 0.7],
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

/* ---------------------------------------------------------------------------
   Subscribe form (View E) — local-only feedback for now.
   --------------------------------------------------------------------------- */

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
      return;
    }

    setMsg('Thanks — you\u2019re on the list.');
    input.value = '';
    anime({
      targets: form.querySelector('.subscribe__btn'),
      scale: [
        { value: 0.96, duration: 120 },
        { value: 1, duration: 220 },
      ],
      easing: 'easeOutBack',
    });
  });
}
