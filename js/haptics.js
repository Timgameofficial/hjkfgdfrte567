/* haptics.js — unified haptic feedback engine (supersedes vibration.js) */
(function (global) {
  let enabled = MBStorage.get('mb_vibration', true);
  const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  function setEnabled(v) { enabled = v; MBStorage.set('mb_vibration', v); }
  function isEnabled() { return enabled; }
  function isSupported() { return supported; }

  function fire(pattern) {
    if (!enabled || !supported) return;
    try { navigator.vibrate(pattern); } catch (e) { /* noop, never breaks the app */ }
  }

  // ---- named intensity presets ----
  const light = () => fire(8);
  const medium = () => fire(18);
  const heavy = () => fire([25, 20, 25]);
  const success = () => fire([15, 30, 15]);
  const rare = () => fire([20, 30, 20]);
  const epic = () => fire([30, 40, 30, 40, 60]);
  const legendary = () => fire([40, 60, 40, 60, 40, 100, 120]);
  const mythic = () => fire([50, 40, 50, 40, 50, 40, 160, 40, 160]);
  const secret = () => fire([80, 40, 80, 40, 200]);
  const achievement = () => fire([12, 40, 12, 40, 30]);
  const levelup = () => fire([20, 30, 20, 30, 20, 30, 80]);
  const overcharge = () => fire([10, 10, 10, 10, 10, 10, 10, 10, 150]);
  const tap = () => fire(6);

  // continuous shake feedback scaled by 0..1 intensity
  function shakeTick(intensity = 0.5) {
    fire(Math.round(4 + intensity * 22));
  }

  // legacy-compatible reveal-by-rarity dispatcher
  function reveal(rarity) {
    switch (rarity) {
      case 'legendary': legendary(); break;
      case 'mythic': mythic(); break;
      case 'secret': secret(); break;
      case 'epic': epic(); break;
      case 'rare': rare(); break;
      case 'uncommon': medium(); break;
      default: light();
    }
  }

  global.MBHaptics = {
    setEnabled, isEnabled, isSupported, fire,
    light, medium, heavy, success, rare, epic, legendary, mythic, secret,
    achievement, levelup, overcharge, tap, shakeTick, reveal
  };
  // backward-compatible alias used by earlier v1 code paths
  global.MBVibration = global.MBHaptics;
})(window);
