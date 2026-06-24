/* ═══════════════════════════════════════════
   MODAL — YouTube Trailer
   Opens modal with thumbnail + Watch on YouTube link.
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const modal       = document.getElementById('videoModal');
  const backdrop    = document.getElementById('modalBackdrop');
  const content     = document.getElementById('modalContent');
  const closeBtn    = document.getElementById('modalClose');
  const overlay     = document.getElementById('modalThumbnailOverlay');
  const thumbImg    = document.getElementById('modalThumbImg');
  const fallbackLink = document.getElementById('modalFallbackLink');

  if (!modal) return;

  let isOpen = false;
  let lastFocused = null;

  function openModal(videoId, title) {
    if (isOpen) return;
    isOpen = true;
    lastFocused = document.activeElement;

    if (thumbImg) {
      const max = 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
      const hq  = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
      thumbImg.src = max;
      thumbImg.alt = title + ' thumbnail';
      thumbImg.onerror = () => { thumbImg.src = hq; };
    }
    if (fallbackLink) {
      fallbackLink.href = 'https://www.youtube.com/watch?v=' + videoId;
      fallbackLink.setAttribute('aria-label', 'Watch ' + title + ' on YouTube');
    }

    if (overlay) overlay.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-label', title);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Move focus to close button for keyboard users (WCAG 2.4.3)
    setTimeout(() => { closeBtn.focus(); }, 50);

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(content,
        { scale: 0.85, opacity: 0, y: 30 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' }
      );
    }
  }

  function closeModal() {
    if (!isOpen) return;
    if (typeof gsap !== 'undefined') {
      gsap.to(content, {
        scale: 0.9, opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: finishClose,
      });
    } else {
      finishClose();
    }
  }

  function finishClose() {
    isOpen = false;
    if (overlay) overlay.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    // Return focus to the element that opened the modal (WCAG 2.4.3)
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll('.trailer-panel').forEach((panel) => {
    // Mouse click
    panel.addEventListener('click', () => {
      const videoId = panel.dataset.videoId;
      const title   = panel.dataset.title || 'Trailer';
      if (videoId) openModal(videoId, title);
    });

    // Keyboard: Enter or Space to open (WCAG 2.1.1)
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const videoId = panel.dataset.videoId;
        const title   = panel.dataset.title || 'Trailer';
        if (videoId) openModal(videoId, title);
      }
    });
  });

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeModal();
  });
  content.addEventListener('click', (e) => e.stopPropagation());
})();
