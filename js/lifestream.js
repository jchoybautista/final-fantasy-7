/* ═══════════════════════════════════════════
   LIFESTREAM — Three.js WebGL Animation
   Ribbon streams flowing left→right on black,
   with center-glow shader and sparkle stars.
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const canvas = document.getElementById('lifestream-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // ── Scene / Camera / Renderer ─────────────
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 22);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000); // Pure black

  // ── Ribbon Shader ─────────────────────────
  // Center-bright, edge-transparent ribbon look
  const ribbonVS = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const ribbonFS = `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      // v=0.5 is ribbon center; fade to 0 at both edges (v=0 and v=1)
      float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);
      float glow = pow(edge, 1.8);
      // Also fade slightly at the very start/end of the ribbon length
      float endFade = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
      gl_FragColor = vec4(uColor * glow, uOpacity * glow * endFade);
    }
  `;

  // ── Stream Definitions ────────────────────
  // Each stream: base Y, Y-amplitude, flow speed, phase offset, ribbon half-width, opacity
  const STREAM_DEFS = [
    { baseY:  3.2, ampY: 2.3, ampY2: 1.2, speed: 0.22, phase: 0.0,  hw: 1.4, opacity: 0.90 },
    { baseY:  1.0, ampY: 3.6, ampY2: 1.6, speed: 0.17, phase: 1.5,  hw: 1.8, opacity: 0.85 },
    { baseY: -1.2, ampY: 3.0, ampY2: 1.1, speed: 0.26, phase: 2.8,  hw: 1.2, opacity: 0.80 },
    { baseY: -3.5, ampY: 2.1, ampY2: 1.4, speed: 0.20, phase: 0.9,  hw: 1.0, opacity: 0.75 },
    { baseY:  4.5, ampY: 1.4, ampY2: 0.8, speed: 0.15, phase: 3.7,  hw: 0.7, opacity: 0.65 },
    { baseY: -0.3, ampY: 4.5, ampY2: 2.0, speed: 0.13, phase: 5.1,  hw: 2.2, opacity: 0.60 },
    { baseY:  2.0, ampY: 1.8, ampY2: 0.9, speed: 0.30, phase: 2.0,  hw: 0.8, opacity: 0.70 },
  ];

  const SEG_N    = 160;  // segments along each ribbon
  const CTRL_N   = 9;    // control points for Catmull-Rom spline

  // Pre-allocate geometry for each ribbon (core + halo layers)
  function makeRibbonGeo(n) {
    const vertCount = (n + 1) * 2;
    const posArr = new Float32Array(vertCount * 3);
    const uvArr  = new Float32Array(vertCount * 2);
    const idxArr = [];

    for (let i = 0; i <= n; i++) {
      const u = i / n;
      uvArr[i * 4]     = u; uvArr[i * 4 + 1] = 1.0; // top edge
      uvArr[i * 4 + 2] = u; uvArr[i * 4 + 3] = 0.0; // bottom edge
      if (i < n) {
        const b = i * 2;
        idxArr.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvArr,  2));
    geo.setIndex(idxArr);
    return geo;
  }

  // Build control points for a stream at time t
  function getCtrlPts(def, time) {
    const pts = [];
    const flowPhase = time * def.speed; // wave phase shifts right over time → "flow" illusion
    for (let i = 0; i < CTRL_N; i++) {
      const f = i / (CTRL_N - 1);
      const x = -34 + f * 68;
      const y = def.baseY
        + Math.sin(f * Math.PI * 2.1 + def.phase + flowPhase) * def.ampY
        + Math.sin(f * Math.PI * 3.9 + def.phase * 1.7 + flowPhase * 0.6) * def.ampY2;
      const z = Math.sin(f * Math.PI * 1.3 + def.phase * 0.8 + flowPhase * 0.4) * 1.8;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }

  // Write ribbon vertex positions into an existing geo's buffer
  const _pt  = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _up  = new THREE.Vector3(0, 0, 1); // camera-facing "up" for cross product
  const _rgt = new THREE.Vector3();

  function updateRibbonGeo(geo, def, time) {
    const pts   = getCtrlPts(def, time);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const n     = SEG_N;
    const pos   = geo.attributes.position.array;

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      curve.getPoint(t, _pt);
      curve.getTangent(t, _tan);
      _rgt.crossVectors(_tan, _up).normalize();

      // Taper: full width in middle, tapers at ends
      const taper = Math.sin(t * Math.PI);
      const hw = def.hw * taper;

      const base = i * 6;
      // Top edge
      pos[base]     = _pt.x + _rgt.x * hw;
      pos[base + 1] = _pt.y + _rgt.y * hw;
      pos[base + 2] = _pt.z;
      // Bottom edge
      pos[base + 3] = _pt.x - _rgt.x * hw;
      pos[base + 4] = _pt.y - _rgt.y * hw;
      pos[base + 5] = _pt.z;
    }

    geo.attributes.position.needsUpdate = true;
  }

  // Create stream objects (core ribbon + wider halo ribbon)
  const CORE_COLOR = new THREE.Color(0x00FFB3);
  const HALO_COLOR = new THREE.Color(0x00EE99);

  const streams = STREAM_DEFS.map((def) => {
    const coreGeo = makeRibbonGeo(SEG_N);
    const haloGeo = makeRibbonGeo(SEG_N);

    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor:   { value: CORE_COLOR },
        uOpacity: { value: def.opacity },
      },
      vertexShader:   ribbonVS,
      fragmentShader: ribbonFS,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      side:           THREE.DoubleSide,
    });

    const haloMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor:   { value: HALO_COLOR },
        uOpacity: { value: def.opacity * 0.28 },
      },
      vertexShader:   ribbonVS,
      fragmentShader: ribbonFS,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      side:           THREE.DoubleSide,
    });

    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    // Halo geo has 2.4× the half-width, reusing same geo shape
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);

    scene.add(coreMesh);
    scene.add(haloMesh);

    return { def, coreGeo, haloGeo, coreMesh, haloMesh };
  });

  // ── Wide ambient glow: extra-thick background ribbons ─
  // A second pass of very wide, very dim ribbons for the "bleed" look
  const GLOW_DEFS = [
    { baseY:  1.8, ampY: 3.0, ampY2: 1.5, speed: 0.18, phase: 0.6,  hw: 5.0, opacity: 0.12 },
    { baseY: -1.5, ampY: 3.5, ampY2: 1.2, speed: 0.14, phase: 3.2,  hw: 6.5, opacity: 0.09 },
  ];

  const glowStreams = GLOW_DEFS.map((def) => {
    const geo = makeRibbonGeo(SEG_N);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor:   { value: new THREE.Color(0x00FF99) },
        uOpacity: { value: def.opacity },
      },
      vertexShader:   ribbonVS,
      fragmentShader: ribbonFS,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      side:           THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return { def, geo, mesh };
  });

  // ── Sparkle Particles ─────────────────────
  function makeGlowTex(size) {
    const c   = document.createElement('canvas');
    c.width   = c.height = size;
    const ctx = c.getContext('2d');
    const g   = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.2,  'rgba(255,255,255,0.8)');
    g.addColorStop(0.5,  'rgba(200,255,240,0.25)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  const glowTex = makeGlowTex(64);

  const SPARK_N = 280;
  const sparkPos    = new Float32Array(SPARK_N * 3);
  const sparkPhase  = new Float32Array(SPARK_N);
  const sparkSpeed  = new Float32Array(SPARK_N);
  const sparkColor  = new Float32Array(SPARK_N * 3); // per-vertex colors

  for (let i = 0; i < SPARK_N; i++) {
    sparkPos[i*3]   = (Math.random() - 0.5) * 70;
    sparkPos[i*3+1] = (Math.random() - 0.5) * 30;
    sparkPos[i*3+2] = (Math.random() - 0.5) * 8 - 2;
    sparkPhase[i]   = Math.random() * Math.PI * 2;
    sparkSpeed[i]   = 0.2 + Math.random() * 0.5;

    // White or green only — no yellow
    const isWhite = Math.random() < 0.5;
    if (isWhite) {
      // Bright white with slight cyan tint
      sparkColor[i*3] = 0.88 + Math.random()*0.12;
      sparkColor[i*3+1] = 1.0;
      sparkColor[i*3+2] = 0.90 + Math.random()*0.10;
    } else {
      // Lifestream green
      sparkColor[i*3] = 0.0;
      sparkColor[i*3+1] = 0.85 + Math.random()*0.15;
      sparkColor[i*3+2] = 0.55 + Math.random()*0.25;
    }
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos,   3));
  sparkGeo.setAttribute('color',    new THREE.BufferAttribute(sparkColor, 3));

  // Large bright stars
  const sparkMat = new THREE.PointsMaterial({
    size:            0.55,
    map:             glowTex,
    vertexColors:    true,
    transparent:     true,
    opacity:         0.90,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(sparkGeo, sparkMat));

  // Tiny ambient dust
  const DUST_N = 600;
  const dustPos = new Float32Array(DUST_N * 3);
  for (let i = 0; i < DUST_N; i++) {
    dustPos[i*3]   = (Math.random() - 0.5) * 80;
    dustPos[i*3+1] = (Math.random() - 0.5) * 35;
    dustPos[i*3+2] = (Math.random() - 0.5) * 12;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.08, color: 0x88FFDD,
    map: glowTex, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ── Mouse Parallax ────────────────────────
  const mouse     = { x: 0, y: 0 };
  const camTarget = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    mouse.x =  (e.clientX / window.innerWidth  - 0.5) * 4;
    mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    mouse.x =  (e.touches[0].clientX / window.innerWidth  - 0.5) * 4;
    mouse.y = -(e.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // ── Resize ────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Animation Loop ────────────────────────
  let time       = 0;
  let frameCount = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.009;
    frameCount++;

    // Update ribbons every 2 frames
    if (frameCount % 2 === 0) {
      streams.forEach((s) => {
        updateRibbonGeo(s.coreGeo, s.def, time);

        // Halo: same path, wider half-width
        const hDef = Object.assign({}, s.def, { hw: s.def.hw * 3.0 });
        updateRibbonGeo(s.haloGeo, hDef, time);
      });

      glowStreams.forEach((s) => {
        updateRibbonGeo(s.geo, s.def, time);
      });
    }

    // Sparkle drift
    const sp = sparkGeo.attributes.position.array;
    for (let i = 0; i < SPARK_N; i++) {
      sp[i*3+1] += Math.sin(time * sparkSpeed[i] + sparkPhase[i]) * 0.006;
      sp[i*3]   += Math.cos(time * sparkSpeed[i] * 0.5 + sparkPhase[i]) * 0.003;
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // Camera parallax
    camTarget.x += (mouse.x - camTarget.x) * 0.04;
    camTarget.y += (mouse.y - camTarget.y) * 0.04;
    camera.position.x = camTarget.x;
    camera.position.y = camTarget.y;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();
})();
