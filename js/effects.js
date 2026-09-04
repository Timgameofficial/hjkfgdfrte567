/* effects.js — cinematic screen effects: flashes, shockwaves, camera shake/zoom, dim/vignette/grain */
(function (global) {
  const prefersReducedMotion = MBQuality.prefersReducedMotion;
  if (prefersReducedMotion) document.body.classList.add('reduced-motion');

  const $ = (id) => document.getElementById(id);

  // ---- flash / shockwave dom effects (inside ball-wrap) ----
  function flashBall(strength = 1) {
    const wrap = $('ball-wrap');
    if (!wrap) return;
    let flash = wrap.querySelector('.ball-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.className = 'ball-flash';
      wrap.appendChild(flash);
    }
    flash.style.setProperty('--flash-strength', strength);
    flash.classList.remove('play');
    void flash.offsetWidth;
    flash.classList.add('play');
  }

  function spawnShockwave(count = 1) {
    const wrap = $('ball-wrap');
    if (!wrap || prefersReducedMotion) return;
    for (let i = 0; i < count; i++) {
      const wave = document.createElement('div');
      wave.className = 'shockwave';
      wave.style.animationDelay = (i * 120) + 'ms';
      wrap.appendChild(wave);
      setTimeout(() => wave.remove(), 1100 + i * 120);
    }
  }

  // ---- camera: subtle zoom + screen shake, used for strong shakes & reveal ----
  function screenShake(durationMs = 300, magnitude = 1) {
    if (prefersReducedMotion) return;
    const app = $('app');
    app.style.setProperty('--shake-mag', Math.min(magnitude, 2));
    app.classList.add('screen-shake');
    clearTimeout(screenShake._t);
    screenShake._t = setTimeout(() => app.classList.remove('screen-shake'), durationMs);
  }

  function cameraZoom(scale = 1.03, durationMs = 700) {
    if (prefersReducedMotion) return;
    const stage = $('ball-stage');
    stage.style.transition = `transform ${durationMs}ms cubic-bezier(.22,.61,.36,1)`;
    stage.style.transform = `scale(${scale})`;
    setTimeout(() => { stage.style.transform = 'scale(1)'; }, durationMs);
  }

  // ---- full-screen cinematic layers ----
  function dimScreen(amount = 0.5, durationMs = 400) {
    const dim = $('cinematic-dim');
    dim.style.transition = `opacity ${durationMs}ms ease`;
    dim.style.opacity = amount;
  }
  function undimScreen(durationMs = 500) {
    const dim = $('cinematic-dim');
    dim.style.transition = `opacity ${durationMs}ms ease`;
    dim.style.opacity = 0;
  }

  function legendaryScreenFlash() {
    let el = $('legendary-screen-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'legendary-screen-flash';
      document.body.appendChild(el);
    }
    el.classList.remove('play');
    void el.offsetWidth;
    el.classList.add('play');
  }

  function chromaticPulse(durationMs = 500) {
    if (prefersReducedMotion || !MBQuality.distortionEnabled()) return;
    const app = $('app');
    app.classList.add('chroma-pulse');
    setTimeout(() => app.classList.remove('chroma-pulse'), durationMs);
  }

  function secretGlitch(onMid, totalMs = 450) {
    const overlay = $('secret-overlay');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => overlay.classList.add('play'));
    setTimeout(() => { if (typeof onMid === 'function') onMid(); }, totalMs * 0.5);
    setTimeout(() => {
      overlay.classList.remove('play');
      setTimeout(() => { overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden', 'true'); }, 300);
    }, totalMs);
  }

  global.MBEffects = {
    prefersReducedMotion,
    flashBall, spawnShockwave, screenShake, cameraZoom,
    dimScreen, undimScreen, legendaryScreenFlash, chromaticPulse, secretGlitch
  };
})(window);
