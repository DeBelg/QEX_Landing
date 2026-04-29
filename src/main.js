import './styles/main.css';
import { initViewportLock } from './features/viewport-lock.js';
import { initFooterYear, initViewReveal } from './features/view-reveal.js';
import { initDeferredEffects } from './features/deferred-effects.js';

initViewportLock();
initFooterYear();
initViewReveal();
initDeferredEffects();
