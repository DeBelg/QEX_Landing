import './styles/main.css';
import { initViewportLock } from './features/viewport-lock.js';
import { initFooterYear, initViewReveal } from './features/view-reveal.js';
import { initDeferredEffects } from './features/deferred-effects.js';

function initContactCopy() {
  const contactLink = document.querySelector('[data-copy-email]');
  const toast = document.querySelector('[data-copy-toast]');

  if (!contactLink || !toast) {
    return;
  }

  let resetToastTimer = 0;

  const showToast = (message, state = 'success') => {
    window.clearTimeout(resetToastTimer);
    toast.textContent = message;
    toast.dataset.state = state;
    toast.dataset.visible = 'true';

    resetToastTimer = window.setTimeout(() => {
      toast.dataset.visible = 'false';
    }, 2200);
  };

  contactLink.addEventListener('click', async () => {
    const email = contactLink.getAttribute('data-copy-email');

    if (!email) {
      return;
    }

    try {
      await navigator.clipboard.writeText(email);
      showToast('Email copied');
    } catch {
      showToast('Could not copy email', 'error');
    }
  });
}

initViewportLock();
initFooterYear();
initViewReveal();
initDeferredEffects();
initContactCopy();
