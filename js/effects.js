/* effects.js — screen flashes, shockwaves, performance & accessibility helpers */
(function (global) {

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  if (prefersReducedMotion) document.body.classList.add('reduced-motion');

  // ---- rough device performance tier detection ----
  function detectPerformanceTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 380;
    let score = cores * 1.2 + mem * 1.5 - (isSmallScreen ? 2 : 0);
    if (prefersReducedMotion) score = 0;
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  let tier = detectPerformanceTier();

  const PARTICLE_BUDGET = { high: 90, medium: 45, low: 18 };
  const BLUR_BUDGET = { high: 18, medium: 8, low: 0 };

  function getParticleBudget() { return prefersReducedMotion ? 0 : PARTICLE_BUDGET[tier]; }
  function getBlurBudget() { return BLUR_BUDGET[tier]; }
  function getTier() { return tier; }

  // simple runtime FPS watchdog — downgrades tier if the device struggles
  let frameTimes = [];
  let lastTick = performance.now();
  function monitorFrame() {
    const now = performance.now();
    frameTimes.push(now - lastTick);
    lastTick = now;
    if (frameTimes.length > 60) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      if (avg > 33 && tier !== 'low') { // sustained < ~30fps
        tier = tier === 'high' ? 'medium' : 'low';
        document.dispatchEvent(new CustomEvent('mb:tierchange', { detail: tier }));
      }
      frameTimes = [];
    }
    requestAnimationFrame(monitorFrame);
  }
  requestAnimationFrame(monitorFrame);

  // ---- flash / shockwave dom effects ----
  function flashBall() {
    const wrap = document.getElementById('ball-wrap');
    if (!wrap) return;
    let flash = wrap.querySelector('.ball-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.className = 'ball-flash';
      wrap.appendChild(flash);
    }
    flash.classList.remove('play');
    void flash.offsetWidth;
    flash.classList.add('play');
  }

  function spawnShockwave() {
    const wrap = document.getElementById('ball-wrap');
    if (!wrap || prefersReducedMotion) return;
    const wave = document.createElement('div');
    wave.className = 'shockwave';
    wrap.appendChild(wave);
    setTimeout(() => wave.remove(), 950);
  }

  function screenShake(durationMs = 300) {
    if (prefersReducedMotion) return;
    const app = document.getElementById('app');
    app.classList.add('screen-shake');
    clearTimeout(screenShake._t);
    screenShake._t = setTimeout(() => app.classList.remove('screen-shake'), durationMs);
  }

  function legendaryScreenFlash() {
    let el = document.getElementById('legendary-screen-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'legendary-screen-flash';
      document.body.appendChild(el);
    }
    el.classList.remove('play');
    void el.offsetWidth;
    el.classList.add('play');
  }

  global.MBEffects = {
    prefersReducedMotion,
    getParticleBudget, getBlurBudget, getTier,
    flashBall, spawnShockwave, screenShake, legendaryScreenFlash
  };
})(window);
