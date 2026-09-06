/* audio.js — synthesized Web Audio engine (no external files, fully offline) */
(function (global) {
  let ctx = null;
  let masterGain = null;
  let ambientNodes = null;
  let chargeNode = null;
  let enabled = MBStorage.get('mb_sound', true);
  let masterVolume = MBStorage.get('mb_volume', 0.8);
  let unlocked = false;

  function getCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = enabled ? masterVolume : 0;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[MagicBall] Web Audio API недоступен.', e);
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const c = getCtx();
    if (!c || unlocked) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    unlocked = true;
  }

  // Some browsers auto-suspend an AudioContext when the tab is backgrounded.
  // unlock() only ever runs once per session (on the first user gesture), so
  // without this, returning to the tab could leave sound silently dead for
  // the rest of the session even though `enabled` still reads true.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && unlocked && ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  });

  function setEnabled(v) {
    enabled = v; MBStorage.set('mb_sound', v);
    if (masterGain) masterGain.gain.setTargetAtTime(v ? masterVolume : 0, getCtx().currentTime, 0.05);
  }
  function isEnabled() { return enabled; }
  function setMasterVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    MBStorage.set('mb_volume', masterVolume);
    if (masterGain && enabled) masterGain.gain.setTargetAtTime(masterVolume, getCtx().currentTime, 0.05);
  }

  function tone({ freq = 440, type = 'sine', duration = 0.2, gain = 0.3, freqEnd = null, delay = 0 }) {
    const c = getCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    const t0 = c.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(masterGain);
    osc.start(t0); osc.stop(t0 + duration + 0.05);
  }

  function noiseBurst({ duration = 0.4, gain = 0.25, filterFreq = 1200, delay = 0 }) {
    const c = getCtx();
    if (!c || !enabled) return;
    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = filterFreq;
    const g = c.createGain();
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(g).connect(masterGain);
    src.start(t0);
  }

  // ---- ambient background hum ----
  function startAmbient() {
    const c = getCtx();
    if (!c || !enabled || ambientNodes) return;
    const osc1 = c.createOscillator(), osc2 = c.createOscillator();
    const g = c.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 80;
    osc2.type = 'sine'; osc2.frequency.value = 120.5;
    g.gain.value = 0.05;
    const lfo = c.createOscillator(), lfoGain = c.createGain();
    lfo.frequency.value = 0.08; lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    osc1.connect(g); osc2.connect(g); g.connect(masterGain);
    osc1.start(); osc2.start(); lfo.start();
    ambientNodes = { osc1, osc2, lfo, g };
  }
  function stopAmbient() {
    if (!ambientNodes) return;
    try { ambientNodes.osc1.stop(); ambientNodes.osc2.stop(); ambientNodes.lfo.stop(); } catch (e) {}
    ambientNodes = null;
  }

  // ---- charge loop: rising pitch tied to shake energy (0..1) ----
  function startCharge() {
    const c = getCtx();
    if (!c || !enabled || chargeNode) return;
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = 150;
    g.gain.value = 0.0001;
    osc.connect(g).connect(masterGain);
    osc.start();
    chargeNode = { osc, g };
  }
  function updateCharge(energy) {
    if (!chargeNode) return;
    const c = getCtx();
    chargeNode.osc.frequency.setTargetAtTime(150 + energy * 500, c.currentTime, 0.08);
    chargeNode.g.gain.setTargetAtTime(enabled ? 0.02 + energy * 0.1 : 0, c.currentTime, 0.08);
  }
  function stopCharge() {
    if (!chargeNode) return;
    const c = getCtx();
    chargeNode.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
    const node = chargeNode; chargeNode = null;
    setTimeout(() => { try { node.osc.stop(); } catch (e) {} }, 300);
  }

  // ---- named one-shot effects ----
  function playClick() { tone({ freq: 900, type: 'sine', duration: 0.06, gain: 0.15 }); }
  function playTap() { tone({ freq: 700, type: 'sine', duration: 0.05, gain: 0.1 }); }
  function playShakeTick(intensity = 1) { noiseBurst({ duration: 0.08, gain: 0.06 * intensity, filterFreq: 1800 + intensity * 400 }); }
  function playWhoosh() {
    tone({ freq: 220, freqEnd: 900, type: 'sawtooth', duration: 0.5, gain: 0.12 });
    noiseBurst({ duration: 0.5, gain: 0.15, filterFreq: 2000 });
  }
  function playSpin() { tone({ freq: 300, freqEnd: 60, type: 'triangle', duration: 0.9, gain: 0.15 }); }
  function playOvercharge() {
    tone({ freq: 90, freqEnd: 40, type: 'sawtooth', duration: 0.6, gain: 0.25 });
    noiseBurst({ duration: 0.6, gain: 0.22, filterFreq: 3200 });
  }

  function playReveal(rarity) {
    switch (rarity) {
      case 'mythic':
        tone({ freq: 300, freqEnd: 2000, type: 'sine', duration: 1.6, gain: 0.28 });
        tone({ freq: 500, type: 'triangle', duration: 1.8, gain: 0.2, delay: 0.2 });
        noiseBurst({ duration: 1, gain: 0.24, filterFreq: 3400 });
        break;
      case 'legendary':
        tone({ freq: 400, freqEnd: 1600, type: 'sine', duration: 1.1, gain: 0.25 });
        tone({ freq: 600, type: 'triangle', duration: 1.4, gain: 0.18, delay: 0.15 });
        noiseBurst({ duration: 0.8, gain: 0.2, filterFreq: 3000 });
        break;
      case 'secret':
        tone({ freq: 90, type: 'sawtooth', duration: 1.2, gain: 0.22 });
        tone({ freq: 1200, type: 'square', duration: 0.15, gain: 0.05, delay: 0.4 });
        break;
      case 'epic':
        tone({ freq: 500, freqEnd: 1100, type: 'sine', duration: 0.8, gain: 0.22 });
        noiseBurst({ duration: 0.5, gain: 0.18, filterFreq: 2400 });
        break;
      case 'rare':
        tone({ freq: 700, freqEnd: 1000, type: 'sine', duration: 0.5, gain: 0.2 });
        break;
      case 'uncommon':
        tone({ freq: 600, freqEnd: 800, type: 'sine', duration: 0.4, gain: 0.18 });
        break;
      default:
        tone({ freq: 500, freqEnd: 750, type: 'sine', duration: 0.35, gain: 0.18 });
    }
  }
  function playAlert() { tone({ freq: 260, type: 'square', duration: 0.15, gain: 0.1 }); }
  function playAchievement() {
    tone({ freq: 500, freqEnd: 900, type: 'sine', duration: 0.3, gain: 0.2 });
    tone({ freq: 900, type: 'sine', duration: 0.4, gain: 0.16, delay: 0.12 });
  }
  function playLevelUp() {
    [0, 0.1, 0.2].forEach((d, i) => tone({ freq: 500 + i * 200, type: 'triangle', duration: 0.35, gain: 0.2, delay: d }));
  }

  global.MBAudio = {
    unlock, setEnabled, isEnabled, setMasterVolume,
    startAmbient, stopAmbient, startCharge, updateCharge, stopCharge,
    playClick, playTap, playShakeTick, playWhoosh, playSpin, playOvercharge,
    playReveal, playAlert, playAchievement, playLevelUp
  };
})(window);
