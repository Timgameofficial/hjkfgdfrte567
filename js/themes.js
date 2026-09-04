/* themes.js — visual theme definitions & switching */
(function (global) {
  const THEMES = [
    { id: 'classic', label: 'Classic', emoji: '🔵', swatch: 'linear-gradient(135deg,#6a5cff,#4fd0ff)' },
    { id: 'dark', label: 'Dark', emoji: '🔴', swatch: 'linear-gradient(135deg,#ff3b5c,#3a0512)' },
    { id: 'toxic', label: 'Toxic', emoji: '🟢', swatch: 'linear-gradient(135deg,#5dff9e,#0fae63)' },
    { id: 'divine', label: 'Divine', emoji: '🟡', swatch: 'linear-gradient(135deg,#ffd76a,#ff9a3d)' },
    { id: 'cosmic', label: 'Cosmic', emoji: '🌌', swatch: 'linear-gradient(135deg,#9b6bff,#4fd0ff,#ff6be0)' }
  ];

  function applyTheme(id) {
    const theme = THEMES.find(t => t.id === id) || THEMES[0];
    document.body.setAttribute('data-theme', theme.id);
    MBStorage.set('mb_theme', theme.id);
    document.dispatchEvent(new CustomEvent('mb:themechange', { detail: theme }));
    return theme;
  }

  function getCurrentTheme() {
    return MBStorage.get('mb_theme', 'classic');
  }

  function renderThemePicker(container) {
    container.innerHTML = '';
    THEMES.forEach(t => {
      const el = document.createElement('button');
      el.className = 'theme-swatch';
      el.style.background = t.swatch;
      el.title = t.label;
      el.setAttribute('aria-label', 'Тема ' + t.label);
      el.textContent = t.emoji;
      if (t.id === getCurrentTheme()) el.classList.add('active');
      el.addEventListener('click', () => {
        applyTheme(t.id);
        container.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        if (global.MBAudio) global.MBAudio.playClick();
        if (global.MBVibration) global.MBVibration.tap();
      });
      container.appendChild(el);
    });
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

  global.MBThemes = { THEMES, applyTheme, getCurrentTheme, renderThemePicker, applyDayNight };
})(window);
