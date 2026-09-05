/* shake.js — device shake detection.
   This intentionally goes back to the SIMPLE delta-threshold + cooldown
   approach from the original build, which was confirmed working reliably on
   a real phone. The more elaborate "charge/energy/settle" engine that
   replaced it turned out to be fragile in real-world conditions (noisy
   sensors, inconsistent event timing) despite passing synthetic tests, so
   we're reverting to the proven approach and just adapting its output shape
   to fit the rest of the V2 app (achievements, cinematic reveal, visuals). */
(function (global) {
  const THRESH_WEAK = 12;
  const THRESH_MEDIUM = 22;
  const THRESH_STRONG = 34;
  const THRESH_OVERCHARGE = 48;
  const COOLDOWN_MS = 3000;

  let lastX = null, lastY = null, lastZ = null, lastTime = 0;
  let locked = false;
  let listening = false;
  let currentIntensity = 0;

  let onTickCb = null;
  let onReleaseCb = null;
  let onOverchargeCb = null;

  function needsPermission() {
    return typeof DeviceMotionEvent !== 'undefined'
      && typeof DeviceMotionEvent.requestPermission === 'function';
  }
  function isSupported() { return typeof window.DeviceMotionEvent !== 'undefined'; }

  async function requestPermission() {
    if (!needsPermission()) return 'granted';
    try { return await DeviceMotionEvent.requestPermission(); }
    catch (e) { return 'denied'; }
  }

  // maps the old three-tier speed reading onto the level names the rest of
  // the app expects (weak/medium/strong/overcharge) and the hint-text stage
  // names app.js listens for (light/medium/strong/veryStrong/overcharge)
  function levelForSpeed(speed) {
    if (speed > THRESH_OVERCHARGE) return 'overcharge';
    if (speed > THRESH_STRONG) return 'strong';
    if (speed > THRESH_MEDIUM) return 'medium';
    return 'weak';
  }
  function stageForLevel(level) {
    if (level === 'weak') return 'light';
    if (level === 'strong') return 'veryStrong';
    return level; // 'medium' and 'overcharge' pass through unchanged
  }

  function handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.x === undefined) return;
    const now = Date.now();
    if (lastX === null) { lastX = acc.x; lastY = acc.y; lastZ = acc.z; lastTime = now; return; }

    const dt = now - lastTime;
    if (dt < 60) return; // throttle sampling, exactly as the proven version did
    lastTime = now;

    const deltaX = Math.abs(acc.x - lastX);
    const deltaY = Math.abs(acc.y - lastY);
    const deltaZ = Math.abs(acc.z - lastZ);
    lastX = acc.x; lastY = acc.y; lastZ = acc.z;

    const speed = deltaX + deltaY + deltaZ;
    currentIntensity = Math.max(0, Math.min(1, speed / 50));

    if (speed > THRESH_WEAK) {
      const level = levelForSpeed(speed);
      if (typeof onTickCb === 'function') {
        onTickCb({ stage: stageForLevel(level), intensity: currentIntensity, energy: currentIntensity });
      }
    }

    if (!locked && speed > THRESH_WEAK) {
      locked = true;
      const level = levelForSpeed(speed);
      if (level === 'overcharge' && typeof onOverchargeCb === 'function') {
        onOverchargeCb({ energy: currentIntensity });
      }
      if (typeof onReleaseCb === 'function') {
        onReleaseCb({ level, energy: currentIntensity, perfect: false, overcharge: level === 'overcharge', peaks: 1, duration: 0 });
      }
      setTimeout(() => { locked = false; currentIntensity = 0; }, COOLDOWN_MS);
    }
  }

  function start(handlers) {
    onTickCb = handlers.onTick;
    onReleaseCb = handlers.onRelease;
    onOverchargeCb = handlers.onOvercharge;
    if (!isSupported()) return false;
    if (!listening) {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
      listening = true;
    }
    return true;
  }
  function stop() {
    if (listening) { window.removeEventListener('devicemotion', handleMotion); listening = false; }
  }

  // manual charge (finger swipes on the ball when sensors are unavailable) —
  // a sufficiently fast swipe just triggers a release directly, same spirit
  // as the original manual fallback button
  function feedManualVelocity(v) {
    currentIntensity = Math.max(currentIntensity * 0.85, v);
    if (v > 0.55 && !locked) {
      locked = true;
      const level = v > 0.85 ? 'strong' : v > 0.65 ? 'medium' : 'weak';
      if (typeof onReleaseCb === 'function') {
        onReleaseCb({ level, energy: v, perfect: false, overcharge: false, peaks: 0, duration: 500 });
      }
      setTimeout(() => { locked = false; currentIntensity = 0; }, COOLDOWN_MS);
    }
  }

  function forceRelease(level = 'medium') {
    if (locked) return;
    locked = true;
    const energy = level === 'overcharge' ? 0.96 : level === 'strong' ? 0.78 : level === 'weak' ? 0.35 : 0.6;
    currentIntensity = energy;
    if (typeof onReleaseCb === 'function') {
      onReleaseCb({ level, energy, perfect: false, overcharge: level === 'overcharge', peaks: 0, duration: 900 });
    }
    setTimeout(() => { locked = false; currentIntensity = 0; }, COOLDOWN_MS);
  }

  function isLocked() { return locked; }
  function getEnergy() { return currentIntensity; }
  function getIntensity() { return currentIntensity; }

  global.MBShake = {
    needsPermission, isSupported, requestPermission,
    start, stop, feedManualVelocity, forceRelease,
    isLocked, getEnergy, getIntensity,
    triggerManual: forceRelease
  };
})(window);
