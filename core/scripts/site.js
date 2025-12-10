function initLazyAnimations() {
  const animatedNodes = Array.from(document.querySelectorAll('[data-anim]'));
  if (!animatedNodes.length) {
    return;
  }

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animationsPreference =
    document.body?.dataset?.animations || document.documentElement?.dataset?.animations;
  const animationsDisabled = animationsPreference === 'off';

  const applyVisibility = (el) => {
    const { animDelay, animDuration } = el.dataset;
    if (animDelay) {
      const parsed = Number(animDelay);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        el.style.setProperty('--anim-delay', `${parsed}ms`);
      }
    }
    if (animDuration) {
      const parsed = Number(animDuration);
      if (!Number.isNaN(parsed) && parsed > 0) {
        el.style.setProperty('--anim-duration', `${parsed}ms`);
      }
    }
    el.classList.add('is-visible');
  };

  if (prefersReduced || animationsDisabled || typeof IntersectionObserver !== 'function') {
    animatedNodes.forEach((el) => applyVisibility(el));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          applyVisibility(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '80px',
    },
  );

  animatedNodes.forEach((el) => observer.observe(el));
}

const ClowerAnimations = {
  init() {
    initLazyAnimations();
  },
  refresh() {
    initLazyAnimations();
  },
};

window.ClowerAnimations = ClowerAnimations;

document.addEventListener('DOMContentLoaded', () => {
  ClowerAnimations.init();
});
