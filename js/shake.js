/* shake.js — Shake Engine 2.0
   device shake detection, iOS permission flow, manual fallback.

   Public API stays close to v1 so app.js integration is simple:
     MBShake.start(onShake, onTick)
       onShake(level, meta)  fires once per completed shake gesture
         level: 'weak' | 'medium' | 'strong'
         meta:  { intensity, energy, perfect, overcharge }
       onTick(state) fires on every processed motion sample (~30Hz) and on
         a passive decay loop, so callers can drive continuous visuals:
         state: { intensity, energy, stage, magnitude }
     MBShake.triggerManual(level)   — manual/no-sensor fallback
     MBShake.needsPermission / isSupported / requestPermission — unchanged
*/
(function (global) {
  const COOLDOWN_MS = 1400;
  const LOW_PASS_ALPHA = 0.22;
  const PEAK_MIN_GAP_MS = 220;
  const ENERGY_DECAY_PER_SEC = 0.55;
  const ENERGY_PER_PEAK = 0.16;
  const PERFECT_WINDOW = [0.55, 0.85];
  const PERFECT_PEAK_COUNT = 4;

  const STAGES = [
    { id: 'idle', max: 0.15 },
    { id: 'light', max: 0.30 },
    { id: 'medium', max: 0.50 },
    { id: 'strong', max: 0.70 },
    { id: 'veryStrong', max: 0.90 },
    { id: 'overcharge', max: 1.001 }
  ];
  function stageFor(intensity) {
    return (STAGES.find(s => intensity <= s.max) || STAGES[STAGES.length - 1]).id;
  }

  let smoothedMag = 0;
  let peakMag = 0;
  let lastAcc = null;
  let lastSampleTime = 0;
  let lastPeakTime = 0;
  let energy = 0;
  let inBandPeakStreak = 0;
  let overchargeFired = false;

  let locked = false;
  let listening = false;
  let onShakeCallback = null;
  let onTickCallback = null;
  let decayLoopHandle = null;

  function needsPermission() {
    return typeof DeviceMotionEvent !== 'undefined'
      && typeof DeviceMotionEvent.requestPermission === 'function';
  }
  function isSupported() {
    return typeof window.DeviceMotionEvent !== 'undefined';
  }
  async function requestPermission() {
    if (!needsPermission()) return 'granted';
    try {
      const result = await DeviceMotionEvent.requestPermission();
      return result;
    } catch (e) {
      return 'denied';
    }
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function normalizeIntensity(mag) {
    const norm = clamp01(mag / 46);
    return Math.pow(norm, 0.85);
  }

  function registerPeak(intensity) {
    energy = clamp01(energy + ENERGY_PER_PEAK * (0.5 + intensity));

    if (intensity >= PERFECT_WINDOW[0] && intensity <= PERFECT_WINDOW[1]) {
      inBandPeakStreak++;
    } else {
      inBandPeakStreak = 0;
    }

    if (energy >= 0.98 && !overchargeFired) {
      overchargeFired = true;
      if (typeof onShakeCallback === 'function') {
        onShakeCallback('strong', { intensity, energy, perfect: false, overcharge: true });
      }
    }
  }

  function handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null) return;
    const now = performance.now();
    if (lastAcc === null) { lastAcc = acc; lastSampleTime = now; return; }

    const dt = now - lastSampleTime;
    if (dt < 33) return;
    lastSampleTime = now;

    const dx = acc.x - lastAcc.x, dy = acc.y - lastAcc.y, dz = acc.z - lastAcc.z;
    lastAcc = acc;
    const rawMag = Math.sqrt(dx * dx + dy * dy + dz * dz);

    smoothedMag = smoothedMag + LOW_PASS_ALPHA * (rawMag - smoothedMag);
    const intensity = normalizeIntensity(smoothedMag);
    peakMag = Math.max(peakMag * 0.9, smoothedMag);

    if (smoothedMag > 9 && (now - lastPeakTime) > PEAK_MIN_GAP_MS) {
      lastPeakTime = now;
      registerPeak(intensity);
    }

    const stage = stageFor(intensity);
    if (typeof onTickCallback === 'function') {
      onTickCallback({ intensity, energy, stage, magnitude: smoothedMag });
    }

    if (!locked && intensity > 0.18) {
      locked = true;
      const level = peakMag > 30 ? 'strong' : (peakMag > 18 ? 'medium' : 'weak');
      const perfect = inBandPeakStreak >= PERFECT_PEAK_COUNT;
      if (typeof onShakeCallback === 'function') {
        onShakeCallback(level, { intensity, energy, perfect, overcharge: false });
      }
      if (perfect) inBandPeakStreak = 0;
      setTimeout(() => { locked = false; peakMag = 0; }, COOLDOWN_MS);
    }
  }

  function startDecayLoop() {
    let last = performance.now();
    function tick() {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (energy > 0) {
        energy = clamp01(energy - ENERGY_DECAY_PER_SEC * dt);
        if (energy < 0.98) overchargeFired = false;
      }
      smoothedMag = Math.max(0, smoothedMag - 12 * dt);
      if (typeof onTickCallback === 'function' && listening) {
        const i = normalizeIntensity(smoothedMag);
        onTickCallback({ intensity: i, energy, stage: stageFor(i), magnitude: smoothedMag });
      }
      decayLoopHandle = requestAnimationFrame(tick);
    }
    decayLoopHandle = requestAnimationFrame(tick);
  }
  function stopDecayLoop() {
    if (decayLoopHandle) cancelAnimationFrame(decayLoopHandle);
    decayLoopHandle = null;
  }

  function start(onShake, onTick) {
    if (!isSupported()) return false;
    onShakeCallback = onShake;
    onTickCallback = onTick;
    if (!listening) {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
      listening = true;
      startDecayLoop();
    }
    return true;
  }

  function stop() {
    if (listening) {
      window.removeEventListener('devicemotion', handleMotion);
      listening = false;
      stopDecayLoop();
    }
  }

  function triggerManual(level = 'medium') {
    if (locked) return;
    locked = true;
    const intensity = level === 'strong' ? 0.8 : level === 'weak' ? 0.3 : 0.55;
    energy = clamp01(energy + 0.3);
    if (typeof onShakeCallback === 'function') {
      onShakeCallback(level, { intensity, energy, perfect: false, overcharge: false });
    }
    setTimeout(() => { locked = false; }, COOLDOWN_MS);
  }

  global.MBShake = {
    needsPermission, isSupported, requestPermission,
    start, stop, triggerManual,
    getEnergy: () => energy,
    getIntensity: () => normalizeIntensity(smoothedMag)
  };
})(window);
