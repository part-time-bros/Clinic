'use strict';

(function () {

  /* Navbar scroll shadow */
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 12);
    }, { passive: true });
  }

  /* Hamburger */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('.mobile-menu-link').forEach(l => {
      l.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* Reveal on scroll */
  const isLow = navigator.deviceMemory <= 1 || navigator.hardwareConcurrency <= 2;
  let revealObs = null;
  if (!isLow) {
    revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }
  // Observe rv-stagger containers
  const staggerObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });
  document.querySelectorAll('.rv-stagger').forEach(el => staggerObs.observe(el));

  // Exposed so site-data.js can re-observe dynamically injected cards
  window.__acReveal = function() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      if (revealObs) revealObs.observe(el);
      else el.classList.add('visible');
    });
    document.querySelectorAll('.rv-stagger:not(.visible)').forEach(el => staggerObs.observe(el));
  };

  /* Count-up for stat numbers */
  function countUp(el) {
    const target = parseInt(el.dataset.count, 10);
    if (!target) return;
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(ease * target).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('en-IN');
    }
    requestAnimationFrame(step);
  }
  const statObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        countUp(e.target);
        statObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => statObs.observe(el));

  /* FAQ accordion */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  /* Form submission (no backend — shows success state) */
  window.submitForm = function (formId, successId) {
    const form = document.getElementById(formId);
    const success = document.getElementById(successId);
    if (!form || !success) return;
    form.style.display = 'none';
    success.style.display = 'flex';
  };

  /* Set date min = today */
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => { el.min = today; });

  /* ── Page transition overlay ── */
  const overlay = document.createElement('div');
  overlay.className = 'page-transition-overlay';
  document.body.appendChild(overlay);

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    // Only internal same-site .html links, not anchors or external
    if (!href || href.startsWith('#') || href.startsWith('http') ||
        href.startsWith('tel:') || href.startsWith('mailto:') ||
        href.startsWith('https://wa') || link.target === '_blank') return;

    link.addEventListener('click', e => {
      e.preventDefault();
      overlay.classList.add('active');
      setTimeout(() => { window.location.href = href; }, 200);
    });
  });

})();
