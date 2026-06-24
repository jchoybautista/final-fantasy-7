/* ═══════════════════════════════════════════
   ANIMATIONS — GSAP ScrollTrigger
   Handles:
     • Hero entrance timeline
     • Section reveal (fade + slide)
     • Clip-path title wipes
     • Horizontal gallery scroll
     • Timeline line draw
     • CountUp for stats & ratings
═══════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    ['.hero-eyebrow', '.hero-logo-wrap', '.hero-subtitle', '.hero-tagline', '.hero-ctas'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // ── Hero entrance sequence ─────────────────
  const heroTl = gsap.timeline({ delay: 0.3 });
  heroTl
    .to('.hero-eyebrow',   { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
    .to('.hero-logo-wrap', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, '-=0.4')
    .to('.hero-subtitle',  { opacity: 1, duration: 0.7, ease: 'power2.out' }, '-=0.3')
    .to('.hero-tagline',   { opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.3')
    .to('.hero-ctas',      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.2');

  // Fade hero content out as user scrolls away
  gsap.to('#heroContent', {
    opacity: 0,
    y: -40,
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: '50% top',
      scrub: 1,
    },
  });

  // ── Utility: count up animation ───────────
  function countUp(el, target, duration, isDecimal) {
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = isDecimal ? parseFloat(target).toFixed(1) : target;
    }
    requestAnimationFrame(tick);
  }

  // ── Section eyebrow reveal ─────────────────
  gsap.utils.toArray('.reveal-text').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      x: 0,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
      },
    });
  });

  // ── Clip-path title reveal ─────────────────
  gsap.utils.toArray('.clip-reveal').forEach((el) => {
    gsap.to(el, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.1,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
      },
    });
  });

  // ── Generic reveal (fade + slide up) ───────
  gsap.utils.toArray('.reveal').forEach((el, i) => {
    // Stats items stagger relative to their grid parent
    const isStatItem  = el.classList.contains('stat-item');
    const isCharCard  = el.classList.contains('character-card');
    const isGameCard  = el.classList.contains('game-card');
    const isRatCard   = el.classList.contains('rating-card');
    const isTrailer   = el.classList.contains('trailer-panel');
    const isAwardCol  = el.classList.contains('awards-column');

    let delay = 0;

    if (isStatItem || isCharCard || isGameCard || isRatCard || isTrailer) {
      // Get position among siblings with same class
      const siblings = Array.from(el.parentElement.children);
      const idx = siblings.indexOf(el);
      delay = idx * 0.1;
    }

    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 90%',
        once: true,
      },
      onStart() {
        // Trigger countUp for stat items
        if (isStatItem) {
          const valueEl  = el.querySelector('.counter-value');
          const target   = parseFloat(el.dataset.counter);
          const decimal  = el.dataset.decimal === 'true';
          if (valueEl && !isNaN(target)) {
            countUp(valueEl, target, 2000, decimal);
          }
        }
      },
    });
  });

  // ── Rating bar fill on reveal ──────────────
  gsap.utils.toArray('.rating-fill').forEach((bar) => {
    const pct = bar.style.getPropertyValue('--pct') || '0%';
    bar.style.width = '0%';
    gsap.to(bar, {
      width: pct,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: bar,
        start: 'top 90%',
        once: true,
      },
    });
  });

  // Rating score countUp
  gsap.utils.toArray('.rating-value').forEach((el) => {
    const target  = parseFloat(el.dataset.target);
    const decimal = el.dataset.decimal === 'true';
    if (isNaN(target)) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter() { countUp(el, target, 1200, decimal); },
    });
  });

  // ── Timeline: line draw ────────────────────
  const tl = document.querySelector('.timeline-track-fill');
  if (tl) {
    gsap.to(tl, {
      height: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: '.timeline-container',
        start: 'top 75%',
        end: 'bottom 30%',
        scrub: 0.8,
      },
    });
  }

  // Timeline entry dots pulse in
  gsap.utils.toArray('.timeline-dot').forEach((dot, i) => {
    gsap.fromTo(dot,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(2)',
        scrollTrigger: {
          trigger: dot,
          start: 'top 85%',
          once: true,
        },
      }
    );
  });

  // Timeline content: alternating slide directions
  gsap.utils.toArray('.timeline-entry').forEach((entry) => {
    const content = entry.querySelector('.timeline-content');
    const side = entry.dataset.side;
    const fromX = side === 'left' ? 30 : -30;

    gsap.fromTo(content,
      { opacity: 0, x: fromX },
      {
        opacity: 1,
        x: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: content,
          start: 'top 88%',
          once: true,
        },
      }
    );
  });

  // ── Awards: staggered badge entrance ───────
  gsap.utils.toArray('.award-badge').forEach((badge, i) => {
    gsap.fromTo(badge,
      { opacity: 0, x: -16 },
      {
        opacity: 1,
        x: 0,
        duration: 0.55,
        delay: (i % 5) * 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: badge,
          start: 'top 90%',
          once: true,
        },
      }
    );
  });

  // ── Horizontal gallery scroll ──────────────
  // Same pinned, scroll-driven horizontal slide on every viewport
  // (desktop AND mobile). The gallery items are sized smaller on mobile
  // via CSS, so the pin distance is actually a bit shorter there.
  const galleryTrack = document.querySelector('.gallery-track');
  const galleryOuter = document.querySelector('.gallery-outer');

  if (galleryTrack && galleryOuter) {
    // On mobile the browser URL bar showing/hiding fires a height-only
    // "resize". Without this, each such event would refresh ScrollTrigger and
    // make the pinned gallery jump. ignoreMobileResize tells ScrollTrigger to
    // ignore those toolbar-driven viewport-height changes.
    ScrollTrigger.config({ ignoreMobileResize: true });

    const getScrollAmount = () => -(galleryTrack.scrollWidth - galleryOuter.offsetWidth);

    // Drive horizontal movement with a tween so containerAnimation works
    const galTween = gsap.to(galleryTrack, {
      x: getScrollAmount,
      ease: 'none',
      scrollTrigger: {
        trigger: '.gallery-section',
        start: 'top top',
        end: () => '+=' + galleryTrack.scrollWidth,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    // Subtle parallax on images/videos relative to the horizontal scroll
    gsap.utils.toArray('.gallery-item img, .gallery-item video').forEach((img) => {
      gsap.to(img, {
        x: -30,
        ease: 'none',
        scrollTrigger: {
          trigger: img.parentElement,
          containerAnimation: galTween,
          start: 'left right',
          end: 'right left',
          scrub: true,
        },
      });
    });

    // Refresh after all assets load so pin-spacer heights are correct.
    window.addEventListener('load', () => {
      requestAnimationFrame(() => ScrollTrigger.refresh(true));
    });

    // Only refresh on a WIDTH change (orientation / desktop resize), never on a
    // height-only change (mobile URL bar) which would otherwise jump the pin.
    let lastWidth = window.innerWidth;
    let resizeTimer;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(true), 150);
    });
  }

  // ── Word-by-word reveal for hero tagline ───
  // Split .hero-tagline words into spans
  const tagline = document.querySelector('.hero-tagline');
  if (tagline) {
    const words = tagline.textContent.split(' ');
    tagline.innerHTML = words
      .map(w => `<span class="word-span" style="display:inline-block;opacity:0;transform:translateY(12px)">${w}</span>`)
      .join(' ');
    gsap.to('.word-span', {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      delay: 1.8,
    });
  }

  // ── Section separator lines ─────────────────
  gsap.utils.toArray('.section').forEach((sec) => {
    const line = sec.querySelector(':scope > .section::before');
    // CSS handles this pseudo-element; animate width via ScrollTrigger
    // Use a real element approach instead — handled in CSS with transition
  });

  // ── Navbar scroll glow ─────────────────────
  // (Handled in main.js via scroll listener for performance)

})();
