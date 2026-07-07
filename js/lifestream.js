/* ═══════════════════════════════════════════
   LIFESTREAM — Three.js WebGL Animation
   Twisted translucent "smoke sheet" ribbons
   flowing on black, with sparkle stars.
   Look: pale mint film, fibrous striations,
   bright fold edges, caustic edge-on lines.
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
  // Translucent smoke-sheet: faint film interior, fine
  // fibrous striations, a bright fold line at the rim,
  // and a grazing-angle boost so the sheet flares into a
  // bright filament wherever it twists edge-on.
  const ribbonVS = `
    varying vec2 vUv;
    varying float vFacing;
    void main() {
      vUv = uv;
      vec3 n = normalize(normalMatrix * normal);
      vFacing = abs(n.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const ribbonFS = `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uTime;
    uniform float uStriae;
    varying vec2 vUv;
    varying float vFacing;
    void main() {
      float across = vUv.y * 2.0 - 1.0;   // -1 at one rim, +1 at the other
      float a = abs(across);
      float endFade = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);

      // Translucent film — thin veil, slightly denser toward the rim
      float film = 0.16 + 0.20 * a * a;

      // Fibrous striations running along the sheet
      float f1 = sin(across * uStriae + vUv.x * 42.0 - uTime * 0.7);
      float f2 = sin(across * uStriae * 2.6 - vUv.x * 73.0 + uTime * 0.5);
      float striae = 0.60 + 0.30 * f1 + 0.10 * f2;

      // Bright fold line just inside the rim
      float fold = smoothstep(0.55, 0.93, a) * smoothstep(1.0, 0.965, a);

      // Caustic: an edge-on sheet packs more light per pixel
      float graze = pow(1.0 - vFacing, 3.0);

      float i = (film * striae + fold * 0.85) * (0.5 + 1.7 * graze) * endFade;

      vec3 col = mix(uColor * 0.40, uColor, clamp(i * 1.6, 0.0, 1.0));
      col = mix(col, vec3(0.93, 1.0, 0.97), pow(min(i, 1.0), 4.0) * 0.7);

      gl_FragColor = vec4(col, uOpacity * clamp(i, 0.0, 1.0));
    }
  `;

  // ── Stream Definitions ────────────────────
  // Each stream: base Y, Y-amplitudes, flow speed, phase offset,
  // ribbon half-width, opacity, plus twist (full turns along the
  // length), twist speed, striation frequency, and billow (width
  // breathing frequency).
  const STREAM_DEFS = [
    { baseY:  3.2, ampY: 2.3, ampY2: 1.2, speed: 0.22, phase: 0.0, hw: 1.7, opacity: 0.78, twist: 2.2, twistPhase: 0.0, twistSpeed: 0.24, striae: 26.0, billow: 2.4 },
    { baseY:  1.0, ampY: 3.6, ampY2: 1.6, speed: 0.17, phase: 1.5, hw: 2.2, opacity: 0.74, twist: 1.6, twistPhase: 2.1, twistSpeed: 0.18, striae: 20.0, billow: 1.8 },
    { baseY: -1.2, ampY: 3.0, ampY2: 1.1, speed: 0.26, phase: 2.8, hw: 1.4, opacity: 0.72, twist: 2.8, twistPhase: 4.0, twistSpeed: 0.28, striae: 30.0, billow: 3.1 },
    { baseY: -3.5, ampY: 2.1, ampY2: 1.4, speed: 0.20, phase: 0.9, hw: 1.2, opacity: 0.65, twist: 2.0, twistPhase: 1.2, twistSpeed: 0.21, striae: 24.0, billow: 2.7 },
    { baseY:  4.5, ampY: 1.4, ampY2: 0.8, speed: 0.15, phase: 3.7, hw: 0.9, opacity: 0.56, twist: 1.4, twistPhase: 5.3, twistSpeed: 0.16, striae: 34.0, billow: 2.0 },
    { baseY: -0.3, ampY: 4.5, ampY2: 2.0, speed: 0.13, phase: 5.1, hw: 2.6, opacity: 0.50, twist: 1.2, twistPhase: 3.3, twistSpeed: 0.13, striae: 16.0, billow: 1.5 },
    { baseY:  2.0, ampY: 1.8, ampY2: 0.9, speed: 0.30, phase: 2.0, hw: 1.0, opacity: 0.63, twist: 2.5, twistPhase: 0.7, twistSpeed: 0.30, striae: 28.0, billow: 2.9 },
  ];

  const SEG_N    = 160;  // segments along each ribbon
  const CTRL_N   = 9;    // control points for Catmull-Rom spline

  // Pre-allocate geometry for each ribbon (positions + normals)
  function makeRibbonGeo(n) {
    const vertCount = (n + 1) * 2;
    const posArr  = new Float32Array(vertCount * 3);
    const normArr = new Float32Array(vertCount * 3);
    const uvArr   = new Float32Array(vertCount * 2);
    const idxArr  = [];

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
    geo.setAttribute('position', new THREE.BufferAttribute(posArr,  3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(normArr, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvArr,   2));
    geo.setIndex(idxArr);
    return geo;
  }

  // Build control points for a stream at time t
  function getCtrlPts(def, time) {
    const pts = [];
    const flowPhase = time * def.speed; // wave phase shifts over time → "flow" illusion
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

  // Write ribbon vertex positions + normals into an existing geo's buffers.
  // The sheet twists around its own tangent so it alternates between a
  // bright edge-on filament and a wide translucent film.
  const _pt  = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _up  = new THREE.Vector3(0, 0, 1); // camera-facing "up" for cross product
  const _rgt = new THREE.Vector3();
  const _nrm = new THREE.Vector3();

  function updateRibbonGeo(geo, def, time) {
    const pts   = getCtrlPts(def, time);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const n     = SEG_N;
    const pos   = geo.attributes.position.array;
    const nrm   = geo.attributes.normal.array;
    const twistBase = def.twistPhase + time * def.twistSpeed;

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      curve.getPoint(t, _pt);
      curve.getTangent(t, _tan);
      _rgt.crossVectors(_tan, _up).normalize();
      _nrm.crossVectors(_tan, _rgt).normalize();

      // Twist angle along the length, with a slow organic wobble
      const theta = twistBase
        + t * def.twist * Math.PI * 2
        + Math.sin(t * 3.0 + def.phase + time * 0.3) * 0.5;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Rotated cross-section direction and sheet normal
      const rx = _rgt.x * cosT + _nrm.x * sinT;
      const ry = _rgt.y * cosT + _nrm.y * sinT;
      const rz = _rgt.z * cosT + _nrm.z * sinT;
      const nx = _nrm.x * cosT - _rgt.x * sinT;
      const ny = _nrm.y * cosT - _rgt.y * sinT;
      const nz = _nrm.z * cosT - _rgt.z * sinT;

      // Taper at ends + slow width "billow" so the sheet breathes
      const taper  = Math.sin(t * Math.PI);
      const billow = 0.6 + 0.4 * Math.sin(t * def.billow * Math.PI * 2 + def.phase * 2.0 + time * 0.25);
      const hw = def.hw * taper * billow;

      const base = i * 6;
      // Top edge
      pos[base]     = _pt.x + rx * hw;
      pos[base + 1] = _pt.y + ry * hw;
      pos[base + 2] = _pt.z + rz * hw;
      // Bottom edge
      pos[base + 3] = _pt.x - rx * hw;
      pos[base + 4] = _pt.y - ry * hw;
      pos[base + 5] = _pt.z - rz * hw;
      // Same sheet normal on both edge vertices
      nrm[base]     = nx; nrm[base + 1] = ny; nrm[base + 2] = nz;
      nrm[base + 3] = nx; nrm[base + 4] = ny; nrm[base + 5] = nz;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate   = true;
  }

  // ── Materials ─────────────────────────────
  // Desaturated mist green — bright folds whiten in the shader
  const MIST_COLOR = new THREE.Color(0.46, 0.94, 0.66);
  const DEEP_COLOR = new THREE.Color(0.24, 0.55, 0.40);

  const allMats = []; // for uTime updates

  function makeRibbonMat(color, opacity, striae) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor:   { value: color },
        uOpacity: { value: opacity },
        uTime:    { value: 0 },
        uStriae:  { value: striae },
      },
      vertexShader:   ribbonVS,
      fragmentShader: ribbonFS,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      side:           THREE.DoubleSide,
    });
    allMats.push(mat);
    return mat;
  }

  // Create stream objects: a main twisted sheet plus a narrower
  // companion sheet slightly offset in phase so the pair braids,
  // and a wide dim halo sheet on the same path for a soft glow bleed.
  const streams = STREAM_DEFS.map((def) => {
    const mainGeo = makeRibbonGeo(SEG_N);
    const compGeo = makeRibbonGeo(SEG_N);
    const haloGeo = makeRibbonGeo(SEG_N);

    const mainMat = makeRibbonMat(MIST_COLOR, def.opacity, def.striae);
    const compMat = makeRibbonMat(MIST_COLOR, def.opacity * 0.85, def.striae * 1.4);
    const haloMat = makeRibbonMat(MIST_COLOR, def.opacity * 0.14, 4.0);

    const compDef = Object.assign({}, def, {
      hw: def.hw * 0.45,
      baseY: def.baseY + 0.4,
      phase: def.phase + 0.35,
      twistPhase: def.twistPhase + 1.3,
      twist: def.twist * 1.15,
    });

    const haloDef = Object.assign({}, def, {
      hw: def.hw * 2.2,
    });

    const mainMesh = new THREE.Mesh(mainGeo, mainMat);
    const compMesh = new THREE.Mesh(compGeo, compMat);
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);

    scene.add(mainMesh);
    scene.add(compMesh);
    scene.add(haloMesh);

    return { def, compDef, haloDef, mainGeo, compGeo, haloGeo, mainMesh, compMesh, haloMesh };
  });

  // ── Wide ambient glow: extra-thick background sheets ─
  // Very wide, very dim, low-frequency — the deep green haze
  const GLOW_DEFS = [
    { baseY:  1.8, ampY: 3.0, ampY2: 1.5, speed: 0.18, phase: 0.6, hw: 5.5, opacity: 0.10, twist: 0.5, twistPhase: 0.2, twistSpeed: 0.06, striae: 8.0, billow: 1.2 },
    { baseY: -1.5, ampY: 3.5, ampY2: 1.2, speed: 0.14, phase: 3.2, hw: 7.0, opacity: 0.08, twist: 0.4, twistPhase: 2.6, twistSpeed: 0.05, striae: 6.0, billow: 1.0 },
  ];

  const glowStreams = GLOW_DEFS.map((def) => {
    const geo = makeRibbonGeo(SEG_N);
    const mat = makeRibbonMat(DEEP_COLOR, def.opacity, def.striae);
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

  // ── Reduced Motion (WCAG 2.3.3) ───────────
  // CSS can't stop a WebGL rAF loop, so handle it here:
  // render one static composed frame instead of animating.
  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Resize ────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (reduceMotion) renderer.render(scene, camera);
  });

  // ── Animation Loop ────────────────────────
  let time       = 0;
  let frameCount = 0;

  function renderStaticFrame() {
    time = 5.0; // a moment where the streams are nicely composed
    streams.forEach((s) => {
      updateRibbonGeo(s.mainGeo, s.def,     time);
      updateRibbonGeo(s.compGeo, s.compDef, time);
      updateRibbonGeo(s.haloGeo, s.haloDef, time);
    });
    glowStreams.forEach((s) => updateRibbonGeo(s.geo, s.def, time));
    for (let i = 0; i < allMats.length; i++) {
      allMats[i].uniforms.uTime.value = time;
    }
    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
    time += 0.009;
    frameCount++;

    // Update ribbons every 2 frames
    if (frameCount % 2 === 0) {
      streams.forEach((s) => {
        updateRibbonGeo(s.mainGeo, s.def,     time);
        updateRibbonGeo(s.compGeo, s.compDef, time);
        updateRibbonGeo(s.haloGeo, s.haloDef, time);
      });

      glowStreams.forEach((s) => {
        updateRibbonGeo(s.geo, s.def, time);
      });
    }

    // Shader time (striation drift)
    for (let i = 0; i < allMats.length; i++) {
      allMats[i].uniforms.uTime.value = time;
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

  if (reduceMotion) {
    renderStaticFrame();
  } else {
    animate();
  }
})();
