/* quality.js — adaptive quality engine (LOW / MEDIUM / HIGH) with FPS-based auto-tuning */
(function (global) {
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const PARTICLE_BUDGET = { low: 16, medium: 42, high: 90 };
  const BLUR_BUDGET = { low: 0, medium: 8, high: 18 };
  const VORTEX_ARMS = { low: 2, medium: 3, high: 5 };
  const RIPPLE_ENABLED = { low: false, medium: true, high: true };
  const DISTORTION_ENABLED = { low: false, medium: false, high: true };

  function detectBaseTier() {
    if (prefersReducedMotion) return 'low';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 380;
    let score = cores * 1.2 + mem * 1.5 - (smallScreen ? 2 : 0);
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  let userOverride = MBStorage.get('mb_quality', 'auto'); // auto | low | medium | high
  let autoTier = detectBaseTier();

  function effectiveTier() {
    return userOverride === 'auto' ? autoTier : userOverride;
  }

  function setUserOverride(v) {
    userOverride = v;
    MBStorage.set('mb_quality', v);
    document.dispatchEvent(new CustomEvent('mb:qualitychange', { detail: effectiveTier() }));
  }
  function getUserOverride() { return userOverride; }

  function getParticleBudget() { return prefersReducedMotion ? Math.round(PARTICLE_BUDGET[effectiveTier()] * 0.3) : PARTICLE_BUDGET[effectiveTier()]; }
  function getBlurBudget() { return BLUR_BUDGET[effectiveTier()]; }
  function getVortexArms() { return VORTEX_ARMS[effectiveTier()]; }
  function rippleEnabled() { return RIPPLE_ENABLED[effectiveTier()] && !prefersReducedMotion; }
  function distortionEnabled() { return DISTORTION_ENABLED[effectiveTier()] && !prefersReducedMotion; }

  // ---- FPS watchdog: downgrades under sustained low FPS, restores when healthy ----
  let frameTimes = [];
  let lastTick = performance.now();
  let lastFps = 60;
  let goodStreak = 0;

  // While the tab is hidden, requestAnimationFrame is throttled or fully
  // paused by the browser, so the gap between frames can balloon to whole
  // seconds — that would look exactly like a catastrophic FPS drop to the
  // watchdog below and incorrectly downgrade quality on every tab switch.
  // Track visibility and drop the single frame that spans the hidden period
  // instead of measuring it.
  let wasHidden = document.hidden;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) wasHidden = true; // discard the next frame's delta
  });

  function frameLoop() {
    const now = performance.now();
    if (wasHidden) { wasHidden = false; lastTick = now; frameTimes = []; }
    else { frameTimes.push(now - lastTick); lastTick = now; }
    if (frameTimes.length >= 45) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      lastFps = Math.round(1000 / avg);
      if (userOverride === 'auto') {
        if (avg > 30 && autoTier !== 'low') { // sustained < ~33fps
          autoTier = autoTier === 'high' ? 'medium' : 'low';
          goodStreak = 0;
          document.dispatchEvent(new CustomEvent('mb:qualitychange', { detail: effectiveTier() }));
        } else if (avg < 18) { // comfortably > 55fps
          goodStreak++;
          if (goodStreak > 4 && autoTier !== 'high') {
            autoTier = autoTier === 'low' ? 'medium' : 'high';
            goodStreak = 0;
            document.dispatchEvent(new CustomEvent('mb:qualitychange', { detail: effectiveTier() }));
          }
        } else {
          goodStreak = 0;
        }
      }
      frameTimes = [];
    }
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);

  function getFps() { return lastFps; }

  global.MBQuality = {
    prefersReducedMotion,
    effectiveTier, setUserOverride, getUserOverride,
    getParticleBudget, getBlurBudget, getVortexArms, rippleEnabled, distortionEnabled,
    getFps
  };
})(window);
