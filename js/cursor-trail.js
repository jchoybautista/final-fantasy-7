/* ═══════════════════════════════════════════
   CURSOR TRAIL — Lifestream wisps
   Site-wide 2D canvas overlay. Mouse movement
   sheds small mako particles that inherit the
   cursor's direction, curl like smoke, drift
   upward and fade in/out. Pointer-events none.
═══════════════════════════════════════════ */
(function () {
  'use strict';

  // Respect reduced motion, skip touch-only devices
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1500;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Pre-rendered glow sprites (fast to draw) ──
  function makeSprite(r, g, b) {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    grad.addColorStop(0,    'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, 'rgba(' + r + ',' + g + ',' + b + ',0.55)');
    grad.addColorStop(0.6,  'rgba(' + r + ',' + g + ',' + b + ',0.12)');
    grad.addColorStop(1,    'rgba(' + r + ',' + g + ',' + b + ',0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, s, s);
    return c;
  }
  const SPRITES = [
    makeSprite(110, 240, 175), // lifestream green
    makeSprite(110, 240, 175),
    makeSprite(170, 255, 215), // pale mint
    makeSprite(225, 255, 245), // near-white spark
  ];

  // ── Particle pool ─────────────────────────
  const MAX_P = 200;
  const pool = [];
  for (let i = 0; i < MAX_P; i++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
                size: 0, sprite: 0, curl: 0, curlF: 0, phase: 0 });
  }
  let aliveCount = 0;

  function spawn(x, y, dirX, dirY, speed) {
    for (let i = 0; i < MAX_P; i++) {
      const p = pool[i];
      if (p.alive) continue;
      p.alive = true;
      // Slight scatter around the cursor path
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      // Inherit a fraction of cursor direction, plus gentle spread
      const inherit = 0.35 + Math.random() * 0.4;
      p.vx = dirX * speed * inherit + (Math.random() - 0.5) * 0.5;
      p.vy = dirY * speed * inherit + (Math.random() - 0.5) * 0.5;
      p.maxLife = 0.7 + Math.random() * 0.9;   // seconds
      p.life = p.maxLife;
      p.size = 5 + Math.random() * 14;
      p.sprite = (Math.random() * SPRITES.length) | 0;
      // Smoke-like curl
      p.curl = (Math.random() - 0.5) * 3.0;
      p.curlF = 2 + Math.random() * 4;
      p.phase = Math.random() * Math.PI * 2;
      aliveCount++;
      return;
    }
  }

  // ── Mouse tracking ────────────────────────
  let mx = -1, my = -1, pmx = -1, pmy = -1;
  let spawnDebt = 0; // distance accumulator → particles per px travelled

  window.addEventListener('mousemove', (e) => {
    if (pmx < 0) { pmx = e.clientX; pmy = e.clientY; }
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  // ── Loop ──────────────────────────────────
  let last = performance.now();
  let idleClear = true;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Emit along the path travelled since last frame (no gaps on fast moves)
    if (mx >= 0 && pmx >= 0) {
      const dx = mx - pmx;
      const dy = my - pmy;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const speed = Math.min(dist / dt / 1000, 1.6); // normalized-ish
        spawnDebt += dist;
        const STEP = 9; // px of travel per particle
        while (spawnDebt > STEP) {
          spawnDebt -= STEP;
          const t = spawnDebt / dist;
          spawn(mx - dx * t, my - dy * t, dirX, dirY, 1.2 + speed * 1.6);
        }
      }
      pmx = mx; pmy = my;
    }

    if (aliveCount === 0) {
      if (!idleClear) { ctx.clearRect(0, 0, W, H); idleClear = true; }
      return;
    }
    idleClear = false;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < MAX_P; i++) {
      const p = pool[i];
      if (!p.alive) continue;

      p.life -= dt;
      if (p.life <= 0) { p.alive = false; aliveCount--; continue; }

      const age = 1 - p.life / p.maxLife; // 0 → 1

      // Motion: inherited drift + smoke curl + gentle mako rise
      const curl = Math.sin(age * p.curlF + p.phase) * p.curl;
      p.x += (p.vx + -p.vy / Math.max(Math.hypot(p.vx, p.vy), 0.001) * curl * 0.2) * dt * 60;
      p.y += (p.vy +  p.vx / Math.max(Math.hypot(p.vx, p.vy), 0.001) * curl * 0.2) * dt * 60 - 14 * dt * age;
      p.vx *= 0.96;
      p.vy *= 0.96;

      // Fade in quickly, fade out slowly; swell slightly then shrink
      const fadeIn  = Math.min(age / 0.12, 1);
      const fadeOut = Math.pow(p.life / p.maxLife, 1.4);
      const alpha = fadeIn * fadeOut;
      const size = p.size * (0.6 + 0.6 * Math.sin(Math.min(age * 1.2, 1) * Math.PI * 0.5));

      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(SPRITES[p.sprite], p.x - size / 2, p.y - size / 2, size, size);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  requestAnimationFrame(frame);
})();
