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
  const CALIBRATION_MAX = 18;
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
  const ACTIVITY_ALPHA = 0.06; // much slower than LOWPASS_ALPHA on purpose — see feedSample
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
  let activityLevel = 0;
  let energy = 0;
  let locked = false;
  let chargeStartTime = null;
  let settleStartTime = null;
  let peaks = [];
  let lastPeakTime = 0;
  let overchargeFired = false;

  let onTickCb = null;
  let onReleaseCb = null;
  let onOverchargeCb = null;

  let lastSampleTime = 0;
  let lastHeartbeatTime = 0;
  const GRAVITY = 9.81;

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

  // Rate-independent motion reading: instead of diffing consecutive raw
  // samples (which breaks down when the sensor fires every ~10ms — each
  // individual delta becomes tiny even during a real shake, so energy kept
  // decaying back to zero between reads), we measure how far the total
  // acceleration magnitude deviates from rest. This stays correct no matter
  // how often the device reports samples.
  function handleMotion(event) {
    const withGravity = event.accelerationIncludingGravity;
    const noGravity = event.acceleration;
    const usingGravity = !!(withGravity && withGravity.x !== null && withGravity.x !== undefined);
    const acc = usingGravity ? withGravity : noGravity;
    if (!acc || acc.x === null || acc.x === undefined) return;

    const now = Date.now();
    const dt = lastSampleTime ? Math.min((now - lastSampleTime) / 1000, 0.1) : 0.016;
    lastSampleTime = now;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const baseline = usingGravity ? GRAVITY : 0;
    const deviation = Math.abs(magnitude - baseline);

    const instant = Math.max(0, Math.min(1, deviation / CALIBRATION_MAX));
    feedSample(instant, dt);
  }

  function feedSample(instant, dt) {
    if (locked) return;

    smoothedIntensity = LOWPASS_ALPHA * instant + (1 - LOWPASS_ALPHA) * smoothedIntensity;
    // A real shake is oscillatory — the phone accelerates, decelerates, and
    // reverses direction many times per second, so the *instant* signal
    // legitimately dips near zero between swings even while someone is
    // shaking vigorously. Reacting to that raw dip (for decay, for settle
    // detection, and especially for the on-screen hint text) made energy
    // drain mid-shake and made the hint flicker between stages every frame.
    // activityLevel is a much slower average that only reflects sustained
    // shaking/stillness, not every individual oscillation.
    activityLevel = ACTIVITY_ALPHA * instant + (1 - ACTIVITY_ALPHA) * activityLevel;

    if (chargeStartTime === null && smoothedIntensity > 0.08) chargeStartTime = Date.now();

    energy = Math.max(0, Math.min(1,
      energy + smoothedIntensity * ENERGY_GAIN * dt - (activityLevel < 0.06 ? ENERGY_DECAY * dt : 0)
    ));

    const now = Date.now();
    if (smoothedIntensity > PEAK_THRESHOLD && (now - lastPeakTime) > PEAK_COOLDOWN_MS) {
      lastPeakTime = now;
      peaks.push(now);
    }

    // stage (used for the on-screen hint text) is driven by the smooth
    // activityLevel/energy, not the jittery instant signal, so the hint text
    // no longer flickers between "заряжаю"/"почти готово" every tick
    const displayLevel = Math.max(activityLevel, energy * 0.6);
    const stage = stageFor(displayLevel);
    if (typeof onTickCb === 'function') onTickCb({ stage, intensity: smoothedIntensity, energy });

    if (!overchargeFired && energy >= OVERCHARGE_THRESHOLD) {
      overchargeFired = true;
      if (typeof onOverchargeCb === 'function') onOverchargeCb({ energy });
    }

    // Elapsed-time based settle check (NOT a cancel/restart setTimeout) — a
    // setTimeout that gets cleared and re-armed on every tick can never fire
    // if ticks arrive more often than the delay itself, which is exactly what
    // happened here (120ms heartbeat vs a 150ms settle delay). Tracking how
    // long the condition has held true directly sidesteps that race.
    // Settle is checked against activityLevel (sustained calm), not the
    // instant signal, so a brief lull mid-shake doesn't falsely trigger it.
    if (energy >= RELEASE_INTENSITY && activityLevel < RELEASE_SETTLE) {
      const chargeDuration = chargeStartTime ? now - chargeStartTime : 0;
      if (chargeDuration >= MIN_CHARGE_MS) {
        if (settleStartTime === null) settleStartTime = now;
        if (now - settleStartTime >= RELEASE_SETTLE_MS) triggerRelease();
      }
    } else {
      settleStartTime = null;
    }

    // a single hard, sharp shake shouldn't require the full charge/settle
    // dance — real phones are noisy, so reward an obvious strong jerk directly
    if (smoothedIntensity >= HARD_SHAKE_INTENSITY && !locked) {
      triggerRelease();
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
    activityLevel = 0;
    chargeStartTime = null;
    peaks = [];
    overchargeFired = false;
    settleStartTime = null;
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
  let heartbeatTimer = null;

  function start(handlers) {
    onTickCb = handlers.onTick;
    onReleaseCb = handlers.onRelease;
    onOverchargeCb = handlers.onOvercharge;
    if (!isSupported()) return false;
    if (!listening) {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
      listening = true;
      // Heartbeat: devicemotion events can stop arriving right when the user
      // stops shaking (or get delayed/throttled by the OS). Without this, the
      // smoothed intensity signal has no new samples to decay through and can
      // get stuck "high" forever, so the charge never settles and releases.
      // This makes sure time keeps moving the state forward even in silence.
      heartbeatTimer = setInterval(() => {
        if (locked) return;
        const now = Date.now();
        const sinceLastSample = lastSampleTime ? now - lastSampleTime : 0;
        if (lastSampleTime && sinceLastSample > 140) {
          const heartbeatDt = Math.min((now - (lastHeartbeatTime || now)) / 1000, 0.15);
          feedSample(0, heartbeatDt);
        }
        lastHeartbeatTime = now;
      }, 120);
    }
    return true;
  }
  function stop() {
    if (listening) {
      window.removeEventListener('devicemotion', handleMotion);
      clearInterval(heartbeatTimer);
      listening = false;
    }
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
