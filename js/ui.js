/* ui.js — panel open/close, toasts, settings controls, pointer interactions */
(function (global) {

  function $(id) { return document.getElementById(id); }

  function openPanel(id) {
    document.querySelectorAll('.panel.open').forEach(p => { if (p.id !== id) closePanel(p.id); });
    const panel = $(id);
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }
  function closePanel(id) {
    const panel = $(id);
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  function togglePanel(id) {
    const panel = $(id);
    panel.classList.contains('open') ? closePanel(id) : openPanel(id);
  }

  function showToast(message) {
    const container = $('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  function showModal(id) {
    const modal = $(id);
    modal.classList.remove('hidden');
  }
  function hideModal(id) {
    const modal = $(id);
    modal.classList.add('hidden');
  }

  function wireCloseButtons() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closePanel(btn.getAttribute('data-close')));
    });
  }

  function wireSettingsToggles({ onSoundChange, onVibrationChange, onEffectsChange, onAnimationsChange, onModeChange }) {
    const soundToggle = $('toggle-sound');
    const vibToggle = $('toggle-vibration');
    const fxToggle = $('toggle-effects');
    const animToggle = $('toggle-animations');
    const modeSelect = $('mode-select');

    soundToggle.checked = MBStorage.get('mb_sound', true);
    vibToggle.checked = MBStorage.get('mb_vibration', true);
    fxToggle.checked = MBStorage.get('mb_effects', true);
    animToggle.checked = MBStorage.get('mb_animations', true);
    modeSelect.value = MBStorage.get('mb_daymode', 'auto');

    soundToggle.addEventListener('change', () => onSoundChange(soundToggle.checked));
    vibToggle.addEventListener('change', () => onVibrationChange(vibToggle.checked));
    fxToggle.addEventListener('change', () => { MBStorage.set('mb_effects', fxToggle.checked); onEffectsChange(fxToggle.checked); });
    animToggle.addEventListener('change', () => onAnimationsChange(animToggle.checked));
    modeSelect.addEventListener('change', () => { MBStorage.set('mb_daymode', modeSelect.value); onModeChange(modeSelect.value); });
  }

  // ---- ball drag-to-rotate (desktop) ----
  function enableBallDrag(ballEl) {
    let dragging = false, startX = 0, rotY = 0;
    ballEl.addEventListener('pointerdown', (e) => {
      dragging = true; startX = e.clientX;
      ballEl.setPointerCapture(e.pointerId);
    });
    ballEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const delta = e.clientX - startX;
      rotY += delta * 0.4;
      ballEl.style.transform = `rotateY(${rotY}deg)`;
      startX = e.clientX;
    });
    const end = () => { dragging = false; };
    ballEl.addEventListener('pointerup', end);
    ballEl.addEventListener('pointercancel', end);
    ballEl.addEventListener('pointerleave', end);
  }

  // ---- click-counter easter egg helper ----
  function createClickCounter(threshold, onReach, resetMs = 2000) {
    let count = 0;
    let timer = null;
    return function bump() {
      count++;
      clearTimeout(timer);
      timer = setTimeout(() => { count = 0; }, resetMs);
      if (count >= threshold) {
        count = 0;
        onReach();
      }
    };
  }

  global.MBUI = {
    openPanel, closePanel, togglePanel,
    showToast, showModal, hideModal,
    wireCloseButtons, wireSettingsToggles,
    enableBallDrag, createClickCounter
  };
})(window);
