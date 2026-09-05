/* ui.js — bottom sheets (with swipe-to-close), toasts, settings wiring, achievement/levelup overlays */
(function (global) {
  const $ = (id) => document.getElementById(id);

  // ===================== BOTTOM SHEETS =====================
  const backdrop = $('sheet-backdrop');
  let openSheetId = null;

  function openSheet(id) {
    if (openSheetId && openSheetId !== id) closeSheet(openSheetId);
    const sheet = $(id);
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => backdrop.classList.add('visible'));
    openSheetId = id;
  }
  function closeSheet(id) {
    const sheet = $(id || openSheetId);
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.style.transform = '';
    backdrop.classList.remove('visible');
    setTimeout(() => { if (!document.querySelector('.sheet.open')) backdrop.classList.add('hidden'); }, 250);
    if (openSheetId === id || !id) openSheetId = null;
  }
  function toggleSheet(id) {
    const sheet = $(id);
    sheet.classList.contains('open') ? closeSheet(id) : openSheet(id);
  }

  backdrop.addEventListener('click', () => { if (openSheetId) closeSheet(openSheetId); });

  // swipe-down-to-close on each sheet's handle + header
  function enableSwipeToClose(sheetEl) {
    const handle = sheetEl.querySelector('.sheet-handle');
    if (!handle) return;
    let startY = 0, currentY = 0, dragging = false;
    const onStart = (e) => {
      dragging = true;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      sheetEl.style.transition = 'none';
    };
    const onMove = (e) => {
      if (!dragging) return;
      currentY = (e.touches ? e.touches[0].clientY : e.clientY);
      const dy = Math.max(0, currentY - startY);
      sheetEl.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      sheetEl.style.transition = '';
      const dy = Math.max(0, currentY - startY);
      if (dy > 90) closeSheet(sheetEl.id); else sheetEl.style.transform = '';
    };
    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove', onMove, { passive: true });
    handle.addEventListener('touchend', onEnd);
    handle.addEventListener('pointerdown', onStart);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
  }

  document.querySelectorAll('.sheet').forEach(enableSwipeToClose);

  // ===================== SIMPLE MODALS (permission / card / daily) =====================
  function showModal(id) { $(id).classList.remove('hidden'); }
  function hideModal(id) { $(id).classList.add('hidden'); }

  // ===================== TOASTS =====================
  function showToast(message) {
    const container = $('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  // ===================== ACHIEVEMENT UNLOCK OVERLAY =====================
  let achvQueue = [];
  let achvShowing = false;
  function showAchievementUnlock(def) {
    achvQueue.push(def);
    if (!achvShowing) drainAchvQueue();
  }
  function drainAchvQueue() {
    const def = achvQueue.shift();
    if (!def) { achvShowing = false; return; }
    achvShowing = true;
    const overlay = $('achievement-overlay');
    $('achievement-icon').textContent = def.icon;
    $('achievement-name').textContent = def.title;
    $('achievement-desc').textContent = def.desc;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (global.MBAudio) global.MBAudio.playAchievement();
    if (global.MBHaptics) global.MBHaptics.achievement();
    setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(() => { overlay.classList.add('hidden'); drainAchvQueue(); }, 350);
    }, 2200);
  }

  // ===================== LEVEL UP OVERLAY =====================
  function showLevelUp({ level, title }) {
    const overlay = $('levelup-overlay');
    $('levelup-level').textContent = level;
    $('levelup-title').textContent = title;
    const fill = $('levelup-xp-fill');
    fill.style.width = '0%';
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => { overlay.classList.add('show'); fill.style.width = '100%'; });
    if (global.MBAudio) global.MBAudio.playLevelUp();
    if (global.MBHaptics) global.MBHaptics.levelup();
    setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.classList.add('hidden'), 350);
    }, 2400);
  }

  function wireCloseButtons() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeSheet(btn.getAttribute('data-close')));
    });
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => hideModal(btn.getAttribute('data-close-modal')));
    });
  }

  function wireSettingsToggles({ onSoundChange, onVibrationChange, onEffectsChange, onAnimationsChange, onModeChange, onQualityChange, onCinematicChange, onFastModeChange, onGameModeChange }) {
    const soundToggle = $('toggle-sound');
    const vibToggle = $('toggle-vibration');
    const fxToggle = $('toggle-effects');
    const animToggle = $('toggle-animations');
    const modeSelect = $('mode-select');
    const qualitySelect = $('quality-select');
    const cinematicToggle = $('toggle-cinematic');
    const fastToggle = $('toggle-fastmode');
    const gameModeSelect = $('game-mode-select');

    soundToggle.checked = MBStorage.get('mb_sound', true);
    vibToggle.checked = MBStorage.get('mb_vibration', true);
    fxToggle.checked = MBStorage.get('mb_effects', true);
    animToggle.checked = MBStorage.get('mb_animations', true);
    modeSelect.value = MBStorage.get('mb_daymode', 'auto');
    qualitySelect.value = MBStorage.get('mb_quality', 'auto');
    cinematicToggle.checked = MBStorage.get('mb_cinematic', true);
    fastToggle.checked = MBStorage.get('mb_fastmode', false);
    gameModeSelect.value = MBStorage.get('mb_gamemode', 'classic');

    soundToggle.addEventListener('change', () => onSoundChange(soundToggle.checked));
    vibToggle.addEventListener('change', () => onVibrationChange(vibToggle.checked));
    fxToggle.addEventListener('change', () => { MBStorage.set('mb_effects', fxToggle.checked); onEffectsChange(fxToggle.checked); });
    animToggle.addEventListener('change', () => onAnimationsChange(animToggle.checked));
    modeSelect.addEventListener('change', () => { MBStorage.set('mb_daymode', modeSelect.value); onModeChange(modeSelect.value); });
    qualitySelect.addEventListener('change', () => { MBQuality.setUserOverride(qualitySelect.value); onQualityChange(qualitySelect.value); });
    cinematicToggle.addEventListener('change', () => { MBStorage.set('mb_cinematic', cinematicToggle.checked); onCinematicChange(cinematicToggle.checked); });
    fastToggle.addEventListener('change', () => { MBStorage.set('mb_fastmode', fastToggle.checked); onFastModeChange(fastToggle.checked); });
    gameModeSelect.addEventListener('change', () => { MBStorage.set('mb_gamemode', gameModeSelect.value); onGameModeChange(gameModeSelect.value); });
  }

  // ---- click-counter easter egg helper ----
  function createClickCounter(threshold, onReach, resetMs = 900) {
    let count = 0, timer = null;
    return function bump() {
      count++;
      clearTimeout(timer);
      timer = setTimeout(() => { count = 0; }, resetMs);
      if (count >= threshold) { count = 0; onReach(); }
      return count;
    };
  }

  global.MBUI = {
    openSheet, closeSheet, toggleSheet,
    showModal, hideModal, showToast,
    showAchievementUnlock, showLevelUp,
    wireCloseButtons, wireSettingsToggles, createClickCounter
  };
})(window);
