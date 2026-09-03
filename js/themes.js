/* themes.js — v2.0: 10 full themes (ball, background, particles, UI) with
   an unlock system tied to achievements/rarity milestones. */
(function (global) {
  const THEMES = [
    { id: 'classic', label: 'Classic', emoji: '🔵', swatch: 'linear-gradient(135deg,#6a5cff,#4fd0ff)', unlock: null },
    { id: 'cosmic',  label: 'Cosmic',  emoji: '🌌', swatch: 'linear-gradient(135deg,#9b6bff,#4fd0ff,#ff6be0)', unlock: null },
    { id: 'void',    label: 'Void',    emoji: '⚫', swatch: 'linear-gradient(135deg,#2b2b3a,#0a0a12)', unlock: { type: 'questions', value: 100, label: '100 вопросов' } },
    { id: 'inferno', label: 'Inferno', emoji: '🔥', swatch: 'linear-gradient(135deg,#ff5c3a,#7a0d0d)', unlock: { type: 'rarity', value: 'epic', label: 'Получи Epic ответ' } },
    { id: 'divine',  label: 'Divine',  emoji: '🟡', swatch: 'linear-gradient(135deg,#ffd76a,#ff9a3d)', unlock: { type: 'rarity', value: 'legendary', label: 'Получи Legendary ответ' } },
    { id: 'toxic',   label: 'Toxic',   emoji: '🟢', swatch: 'linear-gradient(135deg,#5dff9e,#0fae63)', unlock: { type: 'questions', value: 30, label: '30 вопросов' } },
    { id: 'ocean',   label: 'Ocean',   emoji: '🌊', swatch: 'linear-gradient(135deg,#2fd6e8,#0a4a7a)', unlock: { type: 'questions', value: 15, label: '15 вопросов' } },
    { id: 'blood',   label: 'Blood',   emoji: '🩸', swatch: 'linear-gradient(135deg,#c0102a,#2b0208)', unlock: { type: 'achievement', value: 'dark_seeker', label: 'Достижение «Искатель тьмы»' } },
    { id: 'gold',    label: 'Gold',    emoji: '✨', swatch: 'linear-gradient(135deg,#ffe28a,#b8860b)', unlock: { type: 'achievement', value: 'combo_best_ten', label: 'Достижение «Связь установлена»' } },
    { id: 'mystic',  label: 'Mystic',  emoji: '🔮', swatch: 'linear-gradient(135deg,#b06cff,#3a1c6e)', unlock: { type: 'rarity', value: 'mythic', label: 'Получи Mythic ответ' } },
  ];

  function isThemeUnlocked(theme) {
    if (!theme.unlock) return true;
    const stats = MBStorage.get('mb_stats', {});
    if (theme.unlock.type === 'questions') return (stats.totalQuestions || 0) >= theme.unlock.value;
    if (theme.unlock.type === 'rarity') return (stats.rarityCounts && stats.rarityCounts[theme.unlock.value] > 0);
    if (theme.unlock.type === 'achievement') return MBAchievements ? MBAchievements.isUnlocked(theme.unlock.value) : false;
    return true;
  }

  function applyTheme(id) {
    const theme = THEMES.find(t => t.id === id) || THEMES[0];
    if (!isThemeUnlocked(theme)) return getCurrentThemeObj();
    document.body.setAttribute('data-theme', theme.id);
    MBStorage.set('mb_theme', theme.id);
    document.dispatchEvent(new CustomEvent('mb:themechange', { detail: theme }));
    return theme;
  }

  function getCurrentTheme() { return MBStorage.get('mb_theme', 'classic'); }
  function getCurrentThemeObj() { return THEMES.find(t => t.id === getCurrentTheme()) || THEMES[0]; }

  function renderThemePicker(container) {
    container.innerHTML = '';
    THEMES.forEach(t => {
      const unlocked = isThemeUnlocked(t);
      const el = document.createElement('button');
      el.className = 'theme-swatch' + (unlocked ? '' : ' locked');
      el.style.background = t.swatch;
      el.title = unlocked ? t.label : `${t.label} — заблокировано (${t.unlock.label})`;
      el.setAttribute('aria-label', 'Тема ' + t.label + (unlocked ? '' : ', заблокировано'));
      el.textContent = unlocked ? t.emoji : '🔒';
      if (t.id === getCurrentTheme()) el.classList.add('active');
      el.addEventListener('click', () => {
        if (!unlocked) {
          if (global.MBUI) global.MBUI.showToast(`🔒 ${t.label}: ${t.unlock.label}`);
          return;
        }
        applyTheme(t.id);
        container.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        if (global.MBAudio) global.MBAudio.playClick();
        if (global.MBVibration) global.MBVibration.tap();
        const stats = MBStorage.get('mb_stats', {});
        stats.themeSwitched = true;
        MBStorage.set('mb_stats', stats);
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

  global.MBThemes = { THEMES, applyTheme, getCurrentTheme, getCurrentThemeObj, renderThemePicker, applyDayNight, isThemeUnlocked };
})(window);
