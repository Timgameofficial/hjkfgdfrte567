/* themes.js — theme definitions, live preview-before-commit, day/night */
(function (global) {
  const THEMES = [
    { id: 'classic', label: 'Classic', emoji: '🔵', swatch: 'linear-gradient(135deg,#6a5cff,#4fd0ff)' },
    { id: 'dark', label: 'Dark', emoji: '🔴', swatch: 'linear-gradient(135deg,#ff3b5c,#3a0512)' },
    { id: 'toxic', label: 'Toxic', emoji: '🟢', swatch: 'linear-gradient(135deg,#5dff9e,#0fae63)' },
    { id: 'divine', label: 'Divine', emoji: '🟡', swatch: 'linear-gradient(135deg,#ffd76a,#ff9a3d)' },
    { id: 'cosmic', label: 'Cosmic', emoji: '🌌', swatch: 'linear-gradient(135deg,#9b6bff,#4fd0ff,#ff6be0)' },
    { id: 'void', label: 'Void', emoji: '⚫', swatch: 'linear-gradient(135deg,#3a3a4a,#000000)' },
    { id: 'inferno', label: 'Inferno', emoji: '🔥', swatch: 'linear-gradient(135deg,#ff7a1a,#7a0f0f)' },
    { id: 'ocean', label: 'Ocean', emoji: '🌊', swatch: 'linear-gradient(135deg,#2ad6ff,#0a3d6b)' },
    { id: 'gold', label: 'Gold', emoji: '✨', swatch: 'linear-gradient(135deg,#fff3c4,#c9962e)' },
    { id: 'blood', label: 'Blood', emoji: '🩸', swatch: 'linear-gradient(135deg,#c4102f,#2a0106)' },
    { id: 'mystic', label: 'Mystic', emoji: '🔮', swatch: 'linear-gradient(135deg,#c46bff,#3a1266)' },
    { id: 'aurora', label: 'Aurora', emoji: '🌈', swatch: 'linear-gradient(135deg,#5dffb0,#6bb0ff,#c46bff)' }
  ];

  let savedThemeId = MBStorage.get('mb_theme', 'classic');
  let previewingId = null;

  function applyThemeVars(id) {
    document.body.setAttribute('data-theme', id);
  }

  function applyTheme(id) {
    savedThemeId = id;
    previewingId = null;
    applyThemeVars(id);
    MBStorage.set('mb_theme', id);
    document.dispatchEvent(new CustomEvent('mb:themechange', { detail: { id } }));
    return id;
  }

  // preview without persisting — used by the settings sheet's theme grid
  function previewTheme(id) {
    previewingId = id;
    applyThemeVars(id);
    document.dispatchEvent(new CustomEvent('mb:themechange', { detail: { id, preview: true } }));
  }
  function commitPreview() {
    if (previewingId) applyTheme(previewingId);
  }
  function cancelPreview() {
    if (previewingId) {
      previewingId = null;
      applyThemeVars(savedThemeId);
      document.dispatchEvent(new CustomEvent('mb:themechange', { detail: { id: savedThemeId } }));
    }
  }

  function getCurrentTheme() { return savedThemeId; }
  function isPreviewing() { return previewingId; }

  function renderThemePicker(container, previewBar) {
    container.innerHTML = '';
    THEMES.forEach(t => {
      const el = document.createElement('button');
      el.className = 'theme-swatch';
      el.style.background = t.swatch;
      el.title = t.label;
      el.setAttribute('aria-label', 'Тема ' + t.label);
      el.textContent = t.emoji;
      if (t.id === savedThemeId) el.classList.add('active');
      el.addEventListener('click', () => {
        previewTheme(t.id);
        container.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        if (previewBar) {
          previewBar.classList.remove('hidden');
          previewBar.querySelector('#theme-preview-label').textContent = `Предпросмотр: ${t.label}`;
        }
        if (global.MBAudio) global.MBAudio.playClick();
        if (global.MBHaptics) global.MBHaptics.tap();
      });
      container.appendChild(el);
    });
  }

  function unlockedThemesCount() {
    // all themes are unlocked by default in this build; kept as a hook for future gating
    return THEMES.length;
  }

  function applyDayNight(mode) {
    let effectiveMode = mode;
    if (mode === 'auto') {
      const hour = new Date().getHours();
      effectiveMode = (hour >= 7 && hour < 20) ? 'day' : 'night';
    }
    document.body.setAttribute('data-daytime', effectiveMode);
    return effectiveMode;
  }

  global.MBThemes = {
    THEMES, applyTheme, previewTheme, commitPreview, cancelPreview, isPreviewing,
    getCurrentTheme, renderThemePicker, applyDayNight, unlockedThemesCount
  };
})(window);
