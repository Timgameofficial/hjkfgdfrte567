/* shake.js — device shake detection, iOS permission flow, manual fallback */
(function (global) {
  const THRESH_WEAK = 12;
  const THRESH_MEDIUM = 22;
  const THRESH_STRONG = 34;
  const COOLDOWN_MS = 3500;

  let lastX = null, lastY = null, lastZ = null, lastTime = 0;
  let locked = false;
  let listening = false;
  let onShakeCallback = null;
  let onTickCallback = null;

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
      return result; // 'granted' | 'denied'
    } catch (e) {
      return 'denied';
    }
  }

  function handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null) return;
    const now = Date.now();
    if (lastX === null) { lastX = acc.x; lastY = acc.y; lastZ = acc.z; lastTime = now; return; }

    const dt = now - lastTime;
    if (dt < 60) return; // throttle sampling
    lastTime = now;

    const deltaX = Math.abs(acc.x - lastX);
    const deltaY = Math.abs(acc.y - lastY);
    const deltaZ = Math.abs(acc.z - lastZ);
    lastX = acc.x; lastY = acc.y; lastZ = acc.z;

    const speed = deltaX + deltaY + deltaZ;

    if (speed > THRESH_WEAK && typeof onTickCallback === 'function') {
      const level = speed > THRESH_STRONG ? 'strong' : (speed > THRESH_MEDIUM ? 'medium' : 'weak');
      onTickCallback(level, speed);
    }

    if (!locked && speed > THRESH_WEAK) {
      locked = true;
      const level = speed > THRESH_STRONG ? 'strong' : (speed > THRESH_MEDIUM ? 'medium' : 'weak');
      if (typeof onShakeCallback === 'function') onShakeCallback(level, speed);
      setTimeout(() => { locked = false; }, COOLDOWN_MS);
    }
  }

  function start(onShake, onTick) {
    if (!isSupported()) return false;
    onShakeCallback = onShake;
    onTickCallback = onTick;
    if (!listening) {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
      listening = true;
    }
    return true;
  }

  function stop() {
    if (listening) {
      window.removeEventListener('devicemotion', handleMotion);
      listening = false;
    }
  }

  function triggerManual(level = 'medium') {
    if (locked) return;
    locked = true;
    if (typeof onShakeCallback === 'function') onShakeCallback(level, level === 'strong' ? 40 : level === 'weak' ? 14 : 25);
    setTimeout(() => { locked = false; }, COOLDOWN_MS);
  }

  global.MBShake = { needsPermission, isSupported, requestPermission, start, stop, triggerManual };
})(window);
