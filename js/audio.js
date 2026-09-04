/* audio.js — Web Audio API synthesized sound effects with graceful fallback */
(function (global) {
  let ctx = null;
  let masterGain = null;
  let ambientNodes = null;
  let enabled = MBStorage.get('mb_sound', true);
  let unlocked = false;

  function getCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = enabled ? 0.8 : 0;
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

  function setEnabled(v) {
    enabled = v;
    MBStorage.set('mb_sound', v);
    if (masterGain) masterGain.gain.setTargetAtTime(v ? 0.8 : 0, getCtx().currentTime, 0.05);
  }
  function isEnabled() { return enabled; }

  // ---- primitive helpers ----
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
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
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
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(g).connect(masterGain);
    src.start(t0);
  }

  // ---- ambient background ----
  function startAmbient() {
    const c = getCtx();
    if (!c || !enabled || ambientNodes) return;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const g = c.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 80;
    osc2.type = 'sine'; osc2.frequency.value = 120.5;
    g.gain.value = 0.05;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    osc1.connect(g); osc2.connect(g);
    g.connect(masterGain);
    osc1.start(); osc2.start(); lfo.start();
    ambientNodes = { osc1, osc2, lfo, g };
  }
  function stopAmbient() {
    if (!ambientNodes) return;
    try {
      ambientNodes.osc1.stop(); ambientNodes.osc2.stop(); ambientNodes.lfo.stop();
    } catch (e) { /* noop */ }
    ambientNodes = null;
  }

  // ---- sound effects ----
  function playClick() { tone({ freq: 900, type: 'sine', duration: 0.06, gain: 0.15 }); }

  function playShakeTick(intensity = 1) {
    noiseBurst({ duration: 0.08, gain: 0.06 * intensity, filterFreq: 1800 + intensity * 400 });
  }

  function playWhoosh() {
    tone({ freq: 220, freqEnd: 900, type: 'sawtooth', duration: 0.5, gain: 0.12 });
    noiseBurst({ duration: 0.5, gain: 0.15, filterFreq: 2000 });
  }

  function playSpin() {
    tone({ freq: 300, freqEnd: 60, type: 'triangle', duration: 0.9, gain: 0.15 });
  }

  function playReveal(rarity) {
    switch (rarity) {
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
      default:
        tone({ freq: 500, freqEnd: 750, type: 'sine', duration: 0.35, gain: 0.18 });
    }
  }

  function playAlert() { tone({ freq: 260, type: 'square', duration: 0.15, gain: 0.1 }); }

  global.MBAudio = {
    unlock, setEnabled, isEnabled,
    startAmbient, stopAmbient,
    playClick, playShakeTick, playWhoosh, playSpin, playReveal, playAlert
  };
})(window);
