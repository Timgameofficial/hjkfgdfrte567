/* shake.js — v2.0 shake engine: continuous shakeIntensity (0-100%), 5 stages,
   peak detection, smoothing, cooldown, and special shake types
   (Perfect Shake / Overcharge / Calm Shake). */
(function (global) {
  const SAMPLE_MIN_DT = 45;      // ms between accepted samples
  const SMOOTHING = 0.25;        // low-pass factor for intensity
  const COOLDOWN_MS = 2600;      // lockout after a full reveal-triggering shake
  const SUSTAIN_WINDOW_MS = 1400;// window used to detect "sustained strong shaking" (overcharge)
  const OVERCHARGE_MIN_MS = 1100;// time above 85% needed for overcharge
  const CALM_MAX_SPEED = 6;      // speed ceiling for "calm shake" classification
  const PERFECT_LOW = 62, PERFECT_HIGH = 72; // sweet-spot window for "perfect shake" (% intensity)

  let lastX = null, lastY = null, lastZ = null, lastTime = 0;
  let locked = false;
  let listening = false;

  let smoothedIntensity = 0;   // 0..100
  let stage = 0;               // 0..4
  let strongSince = 0;         // timestamp when intensity first crossed 85%
  let sawOnlyCalm = true;      // whether every sample this gesture stayed under CALM_MAX_SPEED
  let gestureActive = false;
  let gestureStartTime = 0;

  let onStageCallback = null;  // (stage, intensityPct)
  let onShakeCallback = null;  // (result) result = { level, intensity, special }

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

  // maps raw accel-delta "speed" to an intensity percentage curve
  function speedToIntensity(speed) {
    // 0 at speed=0, ~100 around speed=42+ (tuned empirically for accelerationIncludingGravity deltas)
    const pct = Math.min(100, (speed / 42) * 100);
    return pct;
  }

  function intensityToStage(pct) {
    if (pct < 6) return 0;
    if (pct < 20) return 1;
    if (pct < 40) return 1;
    if (pct < 65) return 2;
    if (pct < 85) return 3;
    return 4;
  }

  function levelFromIntensity(pct) {
    if (pct < 20) return 'weak';
    if (pct < 40) return 'weak';
    if (pct < 65) return 'medium';
    if (pct < 85) return 'strong';
    return 'extreme';
  }

  function resetGesture() {
    gestureActive = false;
    strongSince = 0;
    sawOnlyCalm = true;
    smoothedIntensity = 0;
    stage = 0;
  }

  function handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null) return;
    const now = Date.now();
    if (lastX === null) { lastX = acc.x; lastY = acc.y; lastZ = acc.z; lastTime = now; return; }

    const dt = now - lastTime;
    if (dt < SAMPLE_MIN_DT) return;
    lastTime = now;

    const dX = Math.abs(acc.x - lastX), dY = Math.abs(acc.y - lastY), dZ = Math.abs(acc.z - lastZ);
    lastX = acc.x; lastY = acc.y; lastZ = acc.z;
    const speed = dX + dY + dZ;

    const rawPct = speedToIntensity(speed);
    smoothedIntensity += (rawPct - smoothedIntensity) * SMOOTHING;
    const pct = Math.max(0, Math.min(100, smoothedIntensity));

    if (locked) return;

    if (pct > 4 && !gestureActive) {
      gestureActive = true;
      gestureStartTime = now;
      sawOnlyCalm = true;
      strongSince = 0;
    }

    if (gestureActive) {
      if (speed > CALM_MAX_SPEED) sawOnlyCalm = false;

      const newStage = intensityToStage(pct);
      if (newStage !== stage) {
        stage = newStage;
        if (typeof onStageCallback === 'function') onStageCallback(stage, pct);
      } else if (typeof onStageCallback === 'function') {
        onStageCallback(stage, pct); // continuous updates for smooth visuals
      }

      if (pct >= 85) {
        if (!strongSince) strongSince = now;
      } else {
        strongSince = 0;
      }

      // Overcharge: sustained extreme shaking
      if (strongSince && (now - strongSince) >= OVERCHARGE_MIN_MS) {
        triggerReveal({ special: 'overcharge', intensity: pct });
        return;
      }

      // natural end-of-gesture detection: if intensity has been trending down
      // and stayed low, and we accumulated meaningful motion, fire the reveal
      if (pct < 8 && (now - gestureStartTime) > 320) {
        // gesture just ended — decide what kind of shake it was
        const peakLevel = stage; // stage already reflects recent peak due to smoothing lag
        finishGesture(peakPctSeen, now);
        return;
      }

      peakPctSeen = Math.max(peakPctSeen || 0, pct);
    }
  }

  let peakPctSeen = 0;

  function finishGesture(peakPct, now) {
    if (peakPct < 12) { resetGesture(); peakPctSeen = 0; return; } // too weak, ignore (jitter)

    let special = null;
    if (sawOnlyCalm && peakPct < 30) {
      special = 'calm';
    } else if (peakPct >= PERFECT_LOW && peakPct <= PERFECT_HIGH) {
      special = 'perfect';
    }

    triggerReveal({ special, intensity: peakPct });
    peakPctSeen = 0;
  }

  function triggerReveal({ special, intensity }) {
    locked = true;
    resetGesture();
    const level = levelFromIntensity(intensity);
    if (typeof onShakeCallback === 'function') {
      onShakeCallback({ level, intensity: Math.round(intensity), special });
    }
    setTimeout(() => { locked = false; }, COOLDOWN_MS);
  }

  function start(onStage, onShake) {
    if (!isSupported()) return false;
    onStageCallback = onStage;
    onShakeCallback = onShake;
    if (!listening) {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
      listening = true;
    }
    return true;
  }
  function stop() {
    if (listening) { window.removeEventListener('devicemotion', handleMotion); listening = false; }
  }

  function triggerManual(level = 'medium') {
    if (locked) return;
    const intensityMap = { weak: 30, medium: 55, strong: 78, extreme: 92 };
    triggerReveal({ special: null, intensity: intensityMap[level] || 55 });
  }

  global.MBShake = {
    needsPermission, isSupported, requestPermission,
    start, stop, triggerManual,
    STAGES: [0, 1, 2, 3, 4]
  };
})(window);
