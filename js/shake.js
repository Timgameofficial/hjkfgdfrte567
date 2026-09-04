/* shake.js — Shake Engine 2.0
   Real motion is turned into a normalized 0..1 "intensity" signal via a low-pass
   filter, then accumulated into a 0..1 "energy" (the charge). When energy is
   released (the user stops shaking after charging enough) a cinematic reveal
   is triggered with a stage derived from the peak energy reached.
   The exact same energy/release pipeline also accepts manual input (finger
   swipes on the ball) so the mechanic works identically without sensors. */
(function (global) {

  // These were tuned conservatively at first and turned out too strict for
  // real (noisy) phone accelerometers — loosened so a normal human shake
  // reliably triggers a release instead of stalling in the "charging" state.
  const CALIBRATION_MAX = 22;
  const LOWPASS_ALPHA = 0.35;
  const ENERGY_GAIN = 1.4;
  const ENERGY_DECAY = 0.5;
  const RELEASE_INTENSITY = 0.42;
  const RELEASE_SETTLE = 0.30;
  const RELEASE_SETTLE_MS = 150;
  const MIN_CHARGE_MS = 220;
  const PEAK_THRESHOLD = 0.4;
  const PEAK_COOLDOWN_MS = 220;
  const OVERCHARGE_THRESHOLD = 0.94;
  const POST_RELEASE_LOCK_MS = 1400;
  const HARD_SHAKE_INTENSITY = 0.8; // a single sharp jerk this strong releases almost immediately

  const STAGE_BANDS = [
    { max: 0.15, id: 'idle' },
    { max: 0.30, id: 'light' },
    { max: 0.50, id: 'medium' },
    { max: 0.70, id: 'strong' },
    { max: 0.90, id: 'veryStrong' },
    { max: 1.01, id: 'overcharge' }
  ];
  function stageFor(intensity) {
    return (STAGE_BANDS.find(b => intensity <= b.max) || STAGE_BANDS[STAGE_BANDS.length - 1]).id;
  }
  function levelForEnergy(e) {
    if (e >= 0.90) return 'overcharge';
    if (e >= 0.70) return 'strong';
    if (e >= 0.50) return 'medium';
    return 'weak';
  }

  let smoothedIntensity = 0;
  let energy = 0;
  let locked = false;
  let chargeStartTime = null;
  let settleTimer = null;
  let peaks = [];
  let lastPeakTime = 0;
  let overchargeFired = false;

  let onTickCb = null;
  let onReleaseCb = null;
  let onOverchargeCb = null;

  let lastX = null, lastY = null, lastZ = null, lastSampleTime = 0;

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

  function handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.x === undefined) return;
    const now = Date.now();
    if (lastX === null) { lastX = acc.x; lastY = acc.y; lastZ = acc.z; lastSampleTime = now; return; }

    const dt = Math.min((now - lastSampleTime) / 1000, 0.1);
    if (dt < 0.02) return;
    lastSampleTime = now;

    const dx = Math.abs(acc.x - lastX), dy = Math.abs(acc.y - lastY), dz = Math.abs(acc.z - lastZ);
    lastX = acc.x; lastY = acc.y; lastZ = acc.z;

    const rawMagnitude = dx + dy + dz;
    const instant = Math.max(0, Math.min(1, rawMagnitude / CALIBRATION_MAX));
    feedSample(instant, dt);
  }

  function feedSample(instant, dt) {
    if (locked) return;

    smoothedIntensity = LOWPASS_ALPHA * instant + (1 - LOWPASS_ALPHA) * smoothedIntensity;

    if (chargeStartTime === null && smoothedIntensity > 0.08) chargeStartTime = Date.now();

    energy = Math.max(0, Math.min(1,
      energy + smoothedIntensity * ENERGY_GAIN * dt - (smoothedIntensity < 0.05 ? ENERGY_DECAY * dt : 0)
    ));

    const now = Date.now();
    if (smoothedIntensity > PEAK_THRESHOLD && (now - lastPeakTime) > PEAK_COOLDOWN_MS) {
      lastPeakTime = now;
      peaks.push(now);
    }

    const stage = stageFor(smoothedIntensity);
    if (typeof onTickCb === 'function') onTickCb({ stage, intensity: smoothedIntensity, energy });

    if (!overchargeFired && energy >= OVERCHARGE_THRESHOLD) {
      overchargeFired = true;
      if (typeof onOverchargeCb === 'function') onOverchargeCb({ energy });
    }

    clearTimeout(settleTimer);
    if (energy >= RELEASE_INTENSITY && smoothedIntensity < RELEASE_SETTLE) {
      const chargeDuration = chargeStartTime ? now - chargeStartTime : 0;
      if (chargeDuration >= MIN_CHARGE_MS) {
        settleTimer = setTimeout(() => triggerRelease(), RELEASE_SETTLE_MS);
      }
    }

    // a single hard, sharp shake shouldn't require the full charge/settle
    // dance — real phones are noisy, so reward an obvious strong jerk directly
    if (smoothedIntensity >= HARD_SHAKE_INTENSITY && !locked) {
      settleTimer = setTimeout(() => triggerRelease(), 120);
    }
  }

  function isPerfectShake(peakCount, durationMs, finalEnergy) {
    return peakCount >= 3 && peakCount <= 7
      && durationMs >= 700 && durationMs <= 2600
      && finalEnergy >= 0.5 && finalEnergy <= 0.85;
  }

  function triggerRelease() {
    if (locked) return;
    locked = true;
    const durationMs = chargeStartTime ? Date.now() - chargeStartTime : 0;
    const finalEnergy = energy;
    const perfect = isPerfectShake(peaks.length, durationMs, finalEnergy);
    const wasOvercharge = overchargeFired;
    const level = wasOvercharge ? 'overcharge' : levelForEnergy(finalEnergy);

    if (typeof onReleaseCb === 'function') {
      onReleaseCb({ level, energy: finalEnergy, perfect, overcharge: wasOvercharge, peaks: peaks.length, duration: durationMs });
    }
    resetChargeState();
    setTimeout(() => { locked = false; }, POST_RELEASE_LOCK_MS);
  }

  function resetChargeState() {
    energy = 0;
    smoothedIntensity = 0;
    chargeStartTime = null;
    peaks = [];
    overchargeFired = false;
    clearTimeout(settleTimer);
  }

  function feedManualVelocity(v, dt) { feedSample(v, dt); }

  function forceRelease(level = 'medium') {
    if (locked) return;
    locked = true;
    energy = level === 'overcharge' ? 0.96 : level === 'strong' ? 0.78 : level === 'weak' ? 0.35 : 0.6;
    if (typeof onReleaseCb === 'function') {
      onReleaseCb({ level, energy, perfect: false, overcharge: level === 'overcharge', peaks: 0, duration: 900 });
    }
    resetChargeState();
    setTimeout(() => { locked = false; }, POST_RELEASE_LOCK_MS);
  }

  let listening = false;
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

  function isLocked() { return locked; }
  function getEnergy() { return energy; }
  function getIntensity() { return smoothedIntensity; }

  global.MBShake = {
    needsPermission, isSupported, requestPermission,
    start, stop, feedManualVelocity, forceRelease,
    isLocked, getEnergy, getIntensity, stageFor, levelForEnergy,
    triggerManual: forceRelease
  };
})(window);
