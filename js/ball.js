/* ball.js — starfield background, orbiting particle system, parallax, sparks */
(function (global) {

  // ===================== BACKGROUND STARFIELD =====================
  const bgCanvas = document.getElementById('bg-canvas');
  const bgCtx = bgCanvas.getContext('2d');
  let stars = [];
  let dust = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let parallax = { x: 0, y: 0 };
  let bgFlashTimer = 0;
  let animationsEnabled = MBStorage.get('mb_animations', true);

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = window.innerWidth * dpr;
    bgCanvas.height = window.innerHeight * dpr;
    bgCanvas.style.width = window.innerWidth + 'px';
    bgCanvas.style.height = window.innerHeight + 'px';
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars();
  }

  function seedStars() {
    const budget = MBEffects.getParticleBudget();
    const starCount = Math.round(budget * 1.6) + 20;
    const dustCount = Math.round(budget * 0.4);
    const isNight = document.body.getAttribute('data-daytime') !== 'day';
    stars = Array.from({ length: isNight ? starCount : Math.round(starCount * 0.4) }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.3,
      tw: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.1
    }));
    dust = Array.from({ length: dustCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 1,
      vy: -(Math.random() * 0.15 + 0.05),
      vx: (Math.random() - 0.5) * 0.1,
      alpha: Math.random() * 0.4 + 0.1
    }));
  }

  function drawBackground(t) {
    const w = window.innerWidth, h = window.innerHeight;
    bgCtx.clearRect(0, 0, w, h);

    // nebula glow blobs
    const style = getComputedStyle(document.body);
    const glowA = style.getPropertyValue('--glow-a').trim() || '#6a5cff';
    const glowB = style.getPropertyValue('--glow-b').trim() || '#b06cff';

    const g1 = bgCtx.createRadialGradient(w * 0.25 + parallax.x, h * 0.3 + parallax.y, 0, w * 0.25, h * 0.3, w * 0.6);
    g1.addColorStop(0, hexToRgba(glowA, 0.10));
    g1.addColorStop(1, 'transparent');
    bgCtx.fillStyle = g1;
    bgCtx.fillRect(0, 0, w, h);

    const g2 = bgCtx.createRadialGradient(w * 0.8 - parallax.x, h * 0.75 - parallax.y, 0, w * 0.8, h * 0.75, w * 0.5);
    g2.addColorStop(0, hexToRgba(glowB, 0.08));
    g2.addColorStop(1, 'transparent');
    bgCtx.fillStyle = g2;
    bgCtx.fillRect(0, 0, w, h);

    // stars
    stars.forEach(s => {
      const twinkle = 0.5 + Math.sin(t * 0.001 * s.speed + s.tw) * 0.5;
      bgCtx.globalAlpha = twinkle * 0.9;
      bgCtx.fillStyle = '#ffffff';
      bgCtx.beginPath();
      bgCtx.arc(s.x + parallax.x * 0.3, s.y + parallax.y * 0.3, s.r, 0, Math.PI * 2);
      bgCtx.fill();
    });
    bgCtx.globalAlpha = 1;

    // drifting dust
    if (animationsEnabled) {
      dust.forEach(d => {
        d.y += d.vy;
        d.x += d.vx;
        if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
        bgCtx.globalAlpha = d.alpha;
        bgCtx.fillStyle = glowB;
        bgCtx.beginPath();
        bgCtx.arc(d.x + parallax.x * 0.5, d.y + parallax.y * 0.5, d.r, 0, Math.PI * 2);
        bgCtx.fill();
      });
      bgCtx.globalAlpha = 1;
    }

    // periodic tiny flash
    bgFlashTimer -= 1;
    if (bgFlashTimer <= 0 && animationsEnabled && Math.random() < 0.004) {
      bgFlashTimer = 200;
      const fx = Math.random() * w, fy = Math.random() * h * 0.6;
      bgCtx.globalAlpha = 0.6;
      bgCtx.fillStyle = '#ffffff';
      bgCtx.beginPath();
      bgCtx.arc(fx, fy, 1.6, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.globalAlpha = 1;
    }
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return `rgba(150,120,255,${alpha})`;
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function bgLoop(t) {
    drawBackground(t);
    requestAnimationFrame(bgLoop);
  }

  // ===================== PARALLAX INPUT =====================
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  window.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    parallax.x = clamp(nx * 24, -24, 24);
    parallax.y = clamp(ny * 24, -24, 24);
    updateHighlightFromParallax(nx, ny);
  }, { passive: true });

  let orientationEnabled = false;
  function enableOrientationParallax() {
    if (orientationEnabled) return;
    orientationEnabled = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      const nx = clamp(e.gamma / 45, -1, 1);
      const ny = clamp((e.beta - 45) / 45, -1, 1);
      parallax.x = nx * 20;
      parallax.y = ny * 20;
      updateHighlightFromParallax(nx, ny);
    }, true);
  }

  function updateHighlightFromParallax(nx, ny) {
    const highlight = document.querySelector('.ball-highlight');
    if (!highlight) return;
    const left = 18 + nx * 8;
    const top = 8 + ny * 8;
    highlight.style.left = left + '%';
    highlight.style.top = top + '%';
  }

  // ===================== BALL PARTICLE SYSTEM (canvas around ball) =====================
  const pCanvas = document.getElementById('particles-canvas');
  const pCtx = pCanvas.getContext('2d');
  let particles = [];
  let particlesMode = 'ambient'; // ambient | burst
  let ballWrapRect = { w: 0, h: 0 };

  function resizeParticleCanvas() {
    const wrap = document.getElementById('ball-wrap');
    const rect = wrap.getBoundingClientRect();
    pCanvas.width = rect.width * 1.8 * dpr;
    pCanvas.height = rect.height * 1.8 * dpr;
    pCanvas.style.width = (rect.width * 1.8) + 'px';
    pCanvas.style.height = (rect.height * 1.8) + 'px';
    pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ballWrapRect = { w: rect.width * 1.8, h: rect.height * 1.8 };
    seedAmbientParticles();
  }

  function seedAmbientParticles() {
    const budget = Math.round(MBEffects.getParticleBudget() * 0.3);
    particles = Array.from({ length: budget }, () => spawnAmbientParticle());
  }

  function spawnAmbientParticle() {
    const angle = Math.random() * Math.PI * 2;
    const radius = ballWrapRect.w * (0.36 + Math.random() * 0.14);
    return {
      angle, radius,
      speed: (Math.random() - 0.5) * 0.006,
      size: Math.random() * 2 + 0.6,
      alpha: Math.random() * 0.5 + 0.2,
      kind: 'ambient'
    };
  }

  function burstParticles(count, colorVar, speedMul = 1) {
    const style = getComputedStyle(document.body);
    const color = style.getPropertyValue(colorVar).trim() || '#8a6bff';
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        angle, radius: ballWrapRect.w * 0.28,
        speed: (0.01 + Math.random() * 0.02) * speedMul,
        outward: 0.6 + Math.random() * 1.8,
        size: Math.random() * 2.6 + 1,
        alpha: 1,
        decay: 0.01 + Math.random() * 0.02,
        color,
        kind: 'burst'
      });
    }
  }

  function drawParticles() {
    pCtx.clearRect(0, 0, ballWrapRect.w, ballWrapRect.h);
    const cx = ballWrapRect.w / 2, cy = ballWrapRect.h / 2;

    particles = particles.filter(p => {
      p.angle += p.speed;
      if (p.kind === 'burst') {
        p.radius += p.outward;
        p.alpha -= p.decay;
      }
      const x = cx + Math.cos(p.angle) * p.radius;
      const y = cy + Math.sin(p.angle) * p.radius * 0.9;
      pCtx.globalAlpha = Math.max(p.alpha, 0);
      pCtx.fillStyle = p.color || '#bda8ff';
      pCtx.beginPath();
      pCtx.arc(x, y, p.size, 0, Math.PI * 2);
      pCtx.fill();
      return p.kind === 'ambient' || p.alpha > 0;
    });
    pCtx.globalAlpha = 1;

    // keep ambient particle count topped up
    if (animationsEnabled) {
      const ambientCount = particles.filter(p => p.kind === 'ambient').length;
      const target = Math.round(MBEffects.getParticleBudget() * 0.3);
      if (ambientCount < target) particles.push(spawnAmbientParticle());
    }
  }

  function particleLoop() {
    if (animationsEnabled || particles.some(p => p.kind === 'burst')) drawParticles();
    requestAnimationFrame(particleLoop);
  }

  // ===================== INTERNAL SPARKS =====================
  function spawnInternalSpark() {
    const layer = document.getElementById('ball-spark-layer');
    if (!layer || MBEffects.prefersReducedMotion) return;
    const spark = document.createElement('div');
    spark.className = 'spark';
    const angle = Math.random() * Math.PI * 2;
    const r = 15 + Math.random() * 20;
    spark.style.left = (50 + Math.cos(angle) * r) + '%';
    spark.style.top = (50 + Math.sin(angle) * r) + '%';
    layer.appendChild(spark);
    requestAnimationFrame(() => {
      spark.style.transition = 'opacity .6s ease, transform .6s ease';
      spark.style.opacity = '1';
      spark.style.transform = 'scale(1.8)';
      setTimeout(() => {
        spark.style.opacity = '0';
        setTimeout(() => spark.remove(), 600);
      }, 250);
    });
  }

  function startAmbientSparkLoop() {
    setInterval(() => {
      if (animationsEnabled && Math.random() < 0.5) spawnInternalSpark();
    }, 1800);
  }

  // ===================== INIT / EXPORTS =====================
  function setAnimationsEnabled(v) {
    animationsEnabled = v;
    MBStorage.set('mb_animations', v);
  }

  function init() {
    resizeCanvas();
    resizeParticleCanvas();
    window.addEventListener('resize', () => { resizeCanvas(); resizeParticleCanvas(); });
    document.addEventListener('mb:themechange', () => {}); // colors read live via getComputedStyle
    requestAnimationFrame(bgLoop);
    requestAnimationFrame(particleLoop);
    startAmbientSparkLoop();
  }

  global.MBBall = {
    init,
    enableOrientationParallax,
    burstParticles,
    spawnInternalSpark,
    setAnimationsEnabled,
    reseedStars: seedStars
  };
})(window);
