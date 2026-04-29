/* ---------------------------------------------------------------------------
   View reveal + footer year
   --------------------------------------------------------------------------- */

export function initFooterYear() {
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

export function initViewReveal() {
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
}
