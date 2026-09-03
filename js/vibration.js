/* vibration.js — Vibration API wrapper with graceful fallback */
(function (global) {
  let enabled = MBStorage.get('mb_vibration', true);
  const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  function setEnabled(v) { enabled = v; MBStorage.set('mb_vibration', v); }
  function isEnabled() { return enabled; }
  function isSupported() { return supported; }

  function fire(pattern) {
    if (!enabled || !supported) return;
    try { navigator.vibrate(pattern); } catch (e) { /* noop */ }
  }

  const tap = () => fire(10);
  const shakeTick = (intensity = 1) => fire(Math.min(6 + intensity * 4, 30));
  const reveal = (rarity) => {
    switch (rarity) {
      case 'legendary': fire([40, 60, 40, 60, 40, 100, 120]); break;
      case 'secret': fire([80, 40, 80, 40, 200]); break;
      case 'epic': fire([30, 40, 30, 40, 60]); break;
      case 'rare': fire([20, 30, 20]); break;
      default: fire(25);
    }
  };

  global.MBVibration = { setEnabled, isEnabled, isSupported, tap, shakeTick, reveal, fire };
})(window);
