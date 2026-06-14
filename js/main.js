/* ═══════════════════════════════════════════
   MAIN — App interactions
   Handles:
     • Navbar scroll state & mobile menu
     • Smooth anchor scroll
     • Character card 3D tilt
     • Rating tabs (Remake / Rebirth switch)
     • Newsletter form validation
     • Game card glow on hover (fallback)
═══════════════════════════════════════════ */
(function () {
  'use strict';

  // Always start at the top on refresh so parallax/pin calculations are correct
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // ── Navbar ────────────────────────────────
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('navHamburger');
  const navLinks  = document.getElementById('navLinks');

  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;

    // Add scrolled class for backdrop blur
    if (y > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScroll = y;
  }, { passive: true });

  // Mobile hamburger toggle
  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Close nav on link click (mobile)
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // ── Smooth anchor scroll ──────────────────
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = navbar.offsetHeight + 16;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ── Character Card 3D Tilt ────────────────
  // Direct transform on mousemove (zero lag) + CSS transition only on exit.
  document.querySelectorAll('.character-card').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      // Suppress transform transition while tracking so tilt follows cursor instantly
      card.style.transition = 'border-color 0.3s ease, box-shadow 0.3s ease';
    });

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const ry = ((e.clientX - cx) / (rect.width  / 2)) * 12;
      const rx = -((e.clientY - cy) / (rect.height / 2)) * 8;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
    });

    card.addEventListener('mouseleave', () => {
      // Enable transform transition only on exit so it springs back smoothly
      card.style.transition = 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.3s ease, box-shadow 0.3s ease';
      card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  });

  // ── Rating Tabs (Remake / Rebirth) ────────
  const tabs        = document.querySelectorAll('.rating-tab');
  const remakeGrid  = document.getElementById('remake-ratings');
  const rebirthGrid = document.getElementById('rebirth-ratings');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const game = tab.dataset.gameTab;
      if (game === 'remake') {
        remakeGrid.classList.remove('hidden');
        rebirthGrid.classList.add('hidden');
      } else {
        rebirthGrid.classList.remove('hidden');
        remakeGrid.classList.add('hidden');
      }

      // Re-animate rating bars for newly shown grid
      const activeGrid = game === 'remake' ? remakeGrid : rebirthGrid;
      activeGrid.querySelectorAll('.rating-fill').forEach((bar) => {
        const pct = bar.style.getPropertyValue('--pct') || '0%';
        bar.style.width = '0%';
        requestAnimationFrame(() => {
          bar.style.transition = 'width 1.2s cubic-bezier(0.4,0,0.2,1)';
          bar.style.width = pct;
        });
      });

      // Re-run countUp for scores
      activeGrid.querySelectorAll('.rating-value').forEach((el) => {
        const target  = parseFloat(el.dataset.target);
        const decimal = el.dataset.decimal === 'true';
        if (isNaN(target)) return;
        el.textContent = '0';
        const start = performance.now();
        function tick(now) {
          const elapsed  = now - start;
          const progress = Math.min(elapsed / 1000, 1);
          const eased    = 1 - Math.pow(1 - progress, 3);
          el.textContent = decimal
            ? (target * eased).toFixed(1)
            : Math.floor(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
          else el.textContent = decimal ? parseFloat(target).toFixed(1) : target;
        }
        requestAnimationFrame(tick);
      });
    });
  });

  // ── Newsletter Form ───────────────────────
  const form        = document.getElementById('newsletterForm');
  const emailInput  = document.getElementById('newsletterEmail');
  const inputGroup  = document.getElementById('newsletterInputGroup');
  const successBox  = document.getElementById('newsletterSuccess');
  const finePrint   = form ? form.querySelector('.newsletter-fine') : null;

  const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = emailInput.value.trim();

      if (!emailRE.test(val)) {
        // Invalid — shake animation
        inputGroup.classList.remove('error');
        // Force reflow so animation restarts
        void inputGroup.offsetWidth;
        inputGroup.classList.add('error');
        emailInput.focus();
        return;
      }

      // Valid — show success
      inputGroup.classList.remove('error');
      inputGroup.style.display = 'none';
      if (finePrint) finePrint.style.display = 'none';
      successBox.removeAttribute('hidden');

      // GSAP entrance if available
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(successBox,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
        );
      }
    });

    // Remove error state on input
    emailInput.addEventListener('input', () => {
      inputGroup.classList.remove('error');
    });
  }

  // ── Active nav link highlighting ──────────
  const sections = document.querySelectorAll('section[id]');
  const navLinkEls = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinkEls.forEach((link) => {
            link.classList.toggle(
              'nav-link-active',
              link.getAttribute('href') === '#' + entry.target.id
            );
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach((sec) => observer.observe(sec));

  // ── Active nav CSS ─────────────────────────
  const style = document.createElement('style');
  style.textContent = `.nav-link-active { color: var(--lifestream) !important; }`;
  document.head.appendChild(style);

})();
