/* ball.js — layered ball rendering: starfield, atmosphere rings, internal
   vortex/core/particles (single canvas for performance), moving reflection,
   touch ripple, and parallax/gyro/drag hookup into the physics engine. */
(function (global) {
  const $ = (id) => document.getElementById(id);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // shared "energy state" driven by the shake engine — read every frame
  const state = { intensity: 0, energy: 0, level: 'idle', collapseProgress: null, collapseStart: 0 };

  // ---- cached theme colors (updated on theme change, not every frame) ----
  let colors = { a: '#6a5cff', b: '#b06cff', c: '#4fd0ff' };
  function refreshColors() {
    const s = getComputedStyle(document.body);
    colors = {
      a: s.getPropertyValue('--glow-a').trim() || '#6a5cff',
      b: s.getPropertyValue('--glow-b').trim() || '#b06cff',
      c: s.getPropertyValue('--glow-c').trim() || '#4fd0ff'
    };
  }
  function hexToRgba(hex, alpha) {
    hex = (hex || '#8a6bff').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return `rgba(138,107,255,${alpha})`;
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
  }

  // ===================== BACKGROUND STARFIELD =====================
  const bgCanvas = $('bg-canvas');
  const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
  let stars = [], dust = [];
  let starSpeedMul = 1; // boosted in mythic mode
  let bgFlashTimer = 0;

  function resizeBg() {
    if (!bgCtx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = window.innerWidth * dpr;
    bgCanvas.height = window.innerHeight * dpr;
    bgCanvas.style.width = window.innerWidth + 'px';
    bgCanvas.style.height = window.innerHeight + 'px';
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars();
  }
  function seedStars() {
    const budget = MBQuality.getParticleBudget();
    const isNight = document.body.getAttribute('data-daytime') !== 'day';
    const starCount = Math.round(budget * 1.5) + 16;
    stars = Array.from({ length: isNight ? starCount : Math.round(starCount * 0.4) }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2, speed: Math.random() * 0.4 + 0.1
    }));
    dust = Array.from({ length: Math.round(budget * 0.35) }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 1, vy: -(Math.random() * 0.15 + 0.05), vx: (Math.random() - 0.5) * 0.1,
      alpha: Math.random() * 0.4 + 0.1
    }));
  }

  let parallax = { x: 0, y: 0 };
  let animationsEnabled = MBStorage.get('mb_animations', true);

  function drawBackground(t) {
    if (!bgCtx) return;
    const w = window.innerWidth, h = window.innerHeight;
    bgCtx.clearRect(0, 0, w, h);

    const g1 = bgCtx.createRadialGradient(w * 0.25 + parallax.x, h * 0.3 + parallax.y, 0, w * 0.25, h * 0.3, w * 0.6);
    g1.addColorStop(0, hexToRgba(colors.a, 0.10)); g1.addColorStop(1, 'transparent');
    bgCtx.fillStyle = g1; bgCtx.fillRect(0, 0, w, h);

    const g2 = bgCtx.createRadialGradient(w * 0.8 - parallax.x, h * 0.75 - parallax.y, 0, w * 0.8, h * 0.75, w * 0.5);
    g2.addColorStop(0, hexToRgba(colors.b, 0.08)); g2.addColorStop(1, 'transparent');
    bgCtx.fillStyle = g2; bgCtx.fillRect(0, 0, w, h);

    stars.forEach(s => {
      const twinkle = 0.5 + Math.sin(t * 0.001 * s.speed * starSpeedMul + s.tw) * 0.5;
      bgCtx.globalAlpha = twinkle * 0.9;
      bgCtx.fillStyle = '#ffffff';
      bgCtx.beginPath();
      bgCtx.arc(s.x + parallax.x * 0.3, s.y + parallax.y * 0.3, s.r, 0, Math.PI * 2);
      bgCtx.fill();
    });
    bgCtx.globalAlpha = 1;

    if (animationsEnabled) {
      dust.forEach(d => {
        d.y += d.vy * starSpeedMul; d.x += d.vx;
        if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
        bgCtx.globalAlpha = d.alpha;
        bgCtx.fillStyle = colors.b;
        bgCtx.beginPath();
        bgCtx.arc(d.x + parallax.x * 0.5, d.y + parallax.y * 0.5, d.r, 0, Math.PI * 2);
        bgCtx.fill();
      });
      bgCtx.globalAlpha = 1;
    }

    bgFlashTimer -= 1;
    if (bgFlashTimer <= 0 && animationsEnabled && Math.random() < 0.004) {
      bgFlashTimer = 200;
      bgCtx.globalAlpha = 0.6; bgCtx.fillStyle = '#ffffff';
      bgCtx.beginPath();
      bgCtx.arc(Math.random() * w, Math.random() * h * 0.6, 1.6, 0, Math.PI * 2);
      bgCtx.fill(); bgCtx.globalAlpha = 1;
    }
  }
  function bgLoop(t) { drawBackground(t); requestAnimationFrame(bgLoop); }

  // ===================== ATMOSPHERE CANVAS (outer halo + energy rings) =====================
  const atmoCanvas = $('atmosphere-canvas');
  const atmoCtx = atmoCanvas ? atmoCanvas.getContext('2d') : null;
  let atmoSize = { w: 0, h: 0 };
  let rings = [];

  function resizeAtmo() {
    if (!atmoCtx) return;
    // trust the CSS (inset:-45%; width/height:190%) instead of re-setting inline
    // style dimensions here — doing so previously collapsed/misaligned the box
    const rect = atmoCanvas.getBoundingClientRect();
    atmoSize = { w: rect.width, h: rect.height };
    atmoCanvas.width = rect.width * dpr;
    atmoCanvas.height = rect.height * dpr;
    atmoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnRings(count = 1) {
    for (let i = 0; i < count; i++) {
      rings.push({ r: atmoSize.w * 0.22, alpha: 0.8, delay: i * 6 });
    }
  }

  function drawAtmosphere() {
    if (!atmoCtx) return;
    atmoCtx.clearRect(0, 0, atmoSize.w, atmoSize.h);
    const cx = atmoSize.w / 2, cy = atmoSize.h / 2;

    // outer halo, breathes with energy
    const haloR = atmoSize.w * (0.38 + state.energy * 0.12 + Math.sin(performance.now() / 900) * 0.015);
    const halo = atmoCtx.createRadialGradient(cx, cy, haloR * 0.3, cx, cy, haloR);
    halo.addColorStop(0, hexToRgba(colors.a, 0.35 + state.energy * 0.35));
    halo.addColorStop(1, 'transparent');
    atmoCtx.fillStyle = halo;
    atmoCtx.beginPath(); atmoCtx.arc(cx, cy, haloR, 0, Math.PI * 2); atmoCtx.fill();

    // energy rings
    rings = rings.filter(ring => {
      if (ring.delay > 0) { ring.delay--; return true; }
      ring.r += 3.2 + state.energy * 2;
      ring.alpha -= 0.018;
      if (ring.alpha <= 0) return false;
      atmoCtx.strokeStyle = hexToRgba(colors.c, ring.alpha);
      atmoCtx.lineWidth = 2;
      atmoCtx.beginPath();
      atmoCtx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      atmoCtx.stroke();
      return true;
    });

    if (animationsEnabled && Math.random() < 0.003 + state.energy * 0.01) spawnRings(1);
  }

  // ===================== INTERNAL BALL CANVAS (mist, vortex, particles, core) =====================
  const ballCanvas = $('ball-canvas');
  const ballCtx = ballCanvas ? ballCanvas.getContext('2d') : null;
  let ballSize = { w: 0, h: 0 };
  let innerParticles = [];
  let vortexAngle = 0;
  let coreFlashUntil = 0;

  function resizeBallCanvas() {
    if (!ballCtx) return;
    const ball = $('ball');
    const rect = ball.getBoundingClientRect();
    ballSize = { w: rect.width, h: rect.height };
    ballCanvas.width = rect.width * dpr;
    ballCanvas.height = rect.height * dpr;
    ballCanvas.style.width = rect.width + 'px';
    ballCanvas.style.height = rect.height + 'px';
    ballCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedInnerParticles();
  }
  function seedInnerParticles() {
    const budget = Math.round(MBQuality.getParticleBudget() * 0.5);
    innerParticles = Array.from({ length: budget }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: ballSize.w * (0.1 + Math.random() * 0.32),
      speed: (Math.random() - 0.5) * 0.004,
      size: Math.random() * 1.6 + 0.5,
      alpha: Math.random() * 0.5 + 0.2
    }));
  }

  function drawBallCanvas(t) {
    if (!ballCtx) return;
    ballCtx.save();
    ballCtx.beginPath();
    ballCtx.arc(ballSize.w / 2, ballSize.h / 2, ballSize.w / 2, 0, Math.PI * 2);
    ballCtx.clip(); // keep everything inside the sphere — no leaks, no isolation hacks needed
    ballCtx.clearRect(0, 0, ballSize.w, ballSize.h);

    const cx = ballSize.w / 2, cy = ballSize.h / 2;

    // drifting mist
    ballCtx.globalCompositeOperation = 'lighter';
    const mistPhase = t * 0.00008;
    [colors.a, colors.b, colors.c].forEach((c, i) => {
      const mx = cx + Math.cos(mistPhase * (i + 1) + i * 2) * ballSize.w * 0.18;
      const my = cy + Math.sin(mistPhase * (i + 1.4) + i) * ballSize.h * 0.18;
      const mr = ballSize.w * (0.32 + state.energy * 0.08);
      const g = ballCtx.createRadialGradient(mx, my, 0, mx, my, mr);
      g.addColorStop(0, hexToRgba(c, 0.16 + state.energy * 0.12));
      g.addColorStop(1, 'transparent');
      ballCtx.fillStyle = g;
      ballCtx.beginPath(); ballCtx.arc(mx, my, mr, 0, Math.PI * 2); ballCtx.fill();
    });

    // vortex spiral arms — speed scales with intensity/energy; collapses on reveal
    const arms = MBQuality.getVortexArms();
    let vortexScale = 1;
    if (state.collapseProgress !== null) {
      const p = state.collapseProgress; // 0..1
      vortexScale = 1 - p; // spiral shrinks toward the center
      vortexAngle += (0.06 + p * 0.9); // spins faster as it collapses
    } else {
      vortexAngle += 0.008 + state.intensity * 0.05 + state.energy * 0.03;
    }
    const armLen = ballSize.w * 0.34 * vortexScale;
    for (let a = 0; a < arms; a++) {
      const armOffset = (a / arms) * Math.PI * 2;
      ballCtx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const f = i / 24;
        const ang = vortexAngle + armOffset + f * 3.2;
        const r = armLen * f;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.92;
        if (i === 0) ballCtx.moveTo(x, y); else ballCtx.lineTo(x, y);
      }
      ballCtx.strokeStyle = hexToRgba(colors.c, 0.22 + state.energy * 0.35);
      ballCtx.lineWidth = 1.4 + state.energy * 1.6;
      ballCtx.stroke();
    }

    // ambient internal particles (stars/dust)
    ballCtx.globalCompositeOperation = 'source-over';
    innerParticles.forEach(p => {
      p.angle += p.speed * (1 + state.energy * 2);
      const x = cx + Math.cos(p.angle) * p.radius * vortexScale;
      const y = cy + Math.sin(p.angle) * p.radius * 0.9 * vortexScale;
      ballCtx.globalAlpha = p.alpha;
      ballCtx.fillStyle = '#ffffff';
      ballCtx.beginPath(); ballCtx.arc(x, y, p.size, 0, Math.PI * 2); ballCtx.fill();
    });
    ballCtx.globalAlpha = 1;

    // ---- CORE ----
    let coreR = ballSize.w * (0.05 + state.energy * 0.09);
    let coreAlpha = 0.55 + state.energy * 0.4;
    if (state.collapseProgress !== null) {
      // core compresses hard right before reveal, then flashes
      coreR = ballSize.w * (0.05 + state.energy * 0.09) * (1 - state.collapseProgress * 0.85);
      coreAlpha = 0.6 + state.collapseProgress * 0.4;
    }
    if (performance.now() < coreFlashUntil) {
      coreR = ballSize.w * 0.5;
      coreAlpha = 1;
    }
    const pulse = 1 + Math.sin(t / 500) * 0.06 * (1 - state.energy);
    ballCtx.globalCompositeOperation = 'lighter';
    const coreGrad = ballCtx.createRadialGradient(cx, cy, 0, cx, cy, coreR * pulse * 2.2);
    coreGrad.addColorStop(0, hexToRgba('#ffffff', coreAlpha));
    coreGrad.addColorStop(0.35, hexToRgba(colors.c, coreAlpha * 0.8));
    coreGrad.addColorStop(1, 'transparent');
    ballCtx.fillStyle = coreGrad;
    ballCtx.beginPath(); ballCtx.arc(cx, cy, coreR * pulse * 2.2, 0, Math.PI * 2); ballCtx.fill();
    ballCtx.globalCompositeOperation = 'source-over';

    ballCtx.restore();
  }

  function collapseVortex(durationMs = 700) {
    state.collapseStart = performance.now();
    state.collapseProgress = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - state.collapseStart) / durationMs);
      state.collapseProgress = p;
      if (p < 1) requestAnimationFrame(step);
      else { coreFlashUntil = performance.now() + 160; setTimeout(() => { state.collapseProgress = null; }, 220); }
    };
    requestAnimationFrame(step);
  }

  function ballLoop(t) {
    // With the simple burst-based shake engine, energy/intensity only get
    // pushed UP during an actual shake tick — nothing ever pushed them back
    // down on its own, so the glow/vortex could stay visually "stuck" high
    // after the user stopped shaking. This gently settles them back to rest.
    if (state.energy > 0) state.energy = Math.max(0, state.energy - 0.012);
    if (state.intensity > 0) state.intensity = Math.max(0, state.intensity * 0.94);

    if (animationsEnabled) drawBallCanvas(t);
    drawAtmosphere();
    requestAnimationFrame(ballLoop);
  }

  // ===================== REFLECTION (moving highlight) =====================
  const reflection = $('ball-reflection');
  let reflTarget = { x: 24, y: 14 };
  let reflCurrent = { x: 24, y: 14 };
  function updateReflectionTarget(nx, ny) {
    reflTarget.x = 24 + nx * 16;
    reflTarget.y = 14 + ny * 14;
  }
  function reflectionLoop(t) {
    // idle ambient drift so the highlight is never perfectly static
    const idle = animationsEnabled ? Math.sin(t / 2600) * 3 : 0;
    reflCurrent.x += (reflTarget.x - reflCurrent.x) * 0.06;
    reflCurrent.y += (reflTarget.y - reflCurrent.y) * 0.06;
    reflection.style.left = (reflCurrent.x + idle) + '%';
    reflection.style.top = (reflCurrent.y + idle * 0.4) + '%';
    requestAnimationFrame(reflectionLoop);
  }

  // ===================== PARALLAX / GYRO / DRAG INPUT =====================
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  window.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    parallax.x = clamp(nx * 24, -24, 24);
    parallax.y = clamp(ny * 24, -24, 24);
    updateReflectionTarget(nx, ny);
  }, { passive: true });

  let orientationEnabled = false;
  function enableOrientationParallax() {
    if (orientationEnabled) return;
    orientationEnabled = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      const nx = clamp(e.gamma / 45, -1, 1);
      const ny = clamp((e.beta - 45) / 45, -1, 1);
      parallax.x = nx * 20; parallax.y = ny * 20;
      updateReflectionTarget(nx, ny);
      MBPhysics.setGyroTilt(-nx * 7); // ball tilts opposite to the phone's lean
    }, true);
  }

  // touch/pointer drag on the ball -> physics offset + reflection + manual charge
  function enableBallPointer(wrapEl) {
    let dragging = false;
    let lastPt = null, lastT = 0;
    let manualCharging = false;

    function spawnRipple(x, y) {
      if (!MBQuality.rippleEnabled()) return;
      const layer = $('ball-ripple-layer');
      const rect = wrapEl.getBoundingClientRect();
      const ripple = document.createElement('div');
      ripple.className = 'touch-ripple';
      ripple.style.left = (x - rect.left) + 'px';
      ripple.style.top = (y - rect.top) + 'px';
      layer.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    }

    wrapEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastPt = { x: e.clientX, y: e.clientY };
      lastT = performance.now();
      wrapEl.setPointerCapture(e.pointerId);
      spawnRipple(e.clientX, e.clientY);
      manualCharging = global.MBBall && global.MBBall._manualModeActive;
    });
    wrapEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = wrapEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      MBPhysics.setDragOffset(dx * 0.06, dy * 0.06);

      const now = performance.now();
      if (lastPt) {
        const dt = Math.max((now - lastT) / 1000, 0.001);
        const dist = Math.hypot(e.clientX - lastPt.x, e.clientY - lastPt.y);
        const speed = Math.min(1, dist / (dt * 900)); // normalize swipe speed
        updateReflectionTarget(clamp(dx / rect.width, -1, 1), clamp(dy / rect.height, -1, 1));
        if (manualCharging) MBShake.feedManualVelocity(speed, dt);
      }
      lastPt = { x: e.clientX, y: e.clientY };
      lastT = now;
    });
    const end = () => { dragging = false; MBPhysics.clearDrag(); };
    wrapEl.addEventListener('pointerup', end);
    wrapEl.addEventListener('pointercancel', end);
    wrapEl.addEventListener('pointerleave', end);
  }

  function setManualModeActive(v) { global.MBBall._manualModeActive = v; }

  // ===================== BURST / REVEAL HOOKS =====================
  function burstCore(ms = 200) { coreFlashUntil = performance.now() + ms; }
  function triggerRings(count = 3) { spawnRings(count); }

  function setEnergyState(patch) { Object.assign(state, patch); }
  function setStarSpeed(mul) { starSpeedMul = mul; }

  function setAnimationsEnabled(v) { animationsEnabled = v; MBStorage.set('mb_animations', v); }

  // ===================== INIT =====================
  function init() {
    refreshColors();
    resizeBg(); resizeAtmo(); resizeBallCanvas();
    window.addEventListener('resize', () => { resizeBg(); resizeAtmo(); resizeBallCanvas(); });
    document.addEventListener('mb:themechange', refreshColors);
    document.addEventListener('mb:qualitychange', () => { seedStars(); seedInnerParticles(); });

    MBPhysics.init($('ball'));
    enableBallPointer($('ball-wrap'));

    requestAnimationFrame(bgLoop);
    requestAnimationFrame(ballLoop);
    requestAnimationFrame(reflectionLoop);
  }

  global.MBBall = {
    init, enableOrientationParallax, setManualModeActive,
    collapseVortex, burstCore, triggerRings, setEnergyState, setStarSpeed,
    setAnimationsEnabled, reseedStars: seedStars,
    _manualModeActive: false
  };
})(window);
