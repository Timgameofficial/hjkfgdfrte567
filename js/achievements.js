/* achievements.js — Achievements 2.0: 40+ achievements, categories, progress bars,
   hidden secret achievements, and a cinematic unlock overlay. */
(function (global) {
  const KEY = 'mb_achievements';

  const CATEGORIES = ['first', 'shake', 'rarity', 'streak', 'discovery', 'time', 'secret'];
  const CATEGORY_LABELS = {
    first: 'Первые шаги', shake: 'Тряска', rarity: 'Редкость',
    streak: 'Серии', discovery: 'Открытия', time: 'Время', secret: 'Секреты'
  };

  const DEFS = [
    // ---- FIRST STEPS ----
    { id: 'first_question', cat: 'first', icon: '🔮', title: 'Первый вопрос', desc: 'Задай свой первый вопрос', check: s => s.totalQuestions >= 1 },
    { id: 'first_prediction', cat: 'first', icon: '🔮', title: 'Первое предсказание', desc: 'Получи своё первое предсказание', check: s => s.totalQuestions >= 1 },
    { id: 'first_answer', cat: 'first', icon: '📜', title: 'Первый ответ', desc: 'Узнай, что скажет шар', check: s => s.totalQuestions >= 1 },
    { id: 'first_history', cat: 'first', icon: '📚', title: 'Первая история', desc: 'Сохрани первую запись в истории', check: s => s.totalQuestions >= 1 },
    { id: 'first_day', cat: 'first', icon: '🌅', title: 'Первый день', desc: 'Используй шар в первый раз', check: s => s.daysUsed.length >= 1 },

    // ---- SHAKING ----
    { id: 'shake_1', cat: 'shake', icon: '📳', title: 'Первый shake', desc: 'Соверши свою первую тряску', check: s => s.totalShakes >= 1 },
    { id: 'shake_10', cat: 'shake', icon: '📳', title: '10 shake', desc: 'Потряси телефон 10 раз', check: s => s.totalShakes >= 10, progress: s => ({ current: s.totalShakes, target: 10 }) },
    { id: 'shake_100', cat: 'shake', icon: '📳', title: '100 shake', desc: 'Потряси телефон 100 раз', check: s => s.totalShakes >= 100, progress: s => ({ current: s.totalShakes, target: 100 }) },
    { id: 'shake_500', cat: 'shake', icon: '📳', title: '500 shake', desc: 'Потряси телефон 500 раз', check: s => s.totalShakes >= 500, progress: s => ({ current: s.totalShakes, target: 500 }) },
    { id: 'perfect_shake', cat: 'shake', icon: '🎯', title: 'Perfect Shake', desc: 'Выполни идеальный ритуал встряски', check: s => s.perfectShakes >= 1 },
    { id: 'perfect_shake_10', cat: 'shake', icon: '🎯', title: '10 Perfect Shake', desc: 'Выполни идеальный ритуал 10 раз', check: s => s.perfectShakes >= 10, progress: s => ({ current: s.perfectShakes, target: 10 }) },
    { id: 'overcharge_1', cat: 'shake', icon: '⚡', title: 'Overcharge', desc: 'Перезаряди шар до предела', check: s => s.overcharges >= 1 },
    { id: 'overcharge_10', cat: 'shake', icon: '⚡', title: '10 Overcharge', desc: 'Перезаряди шар 10 раз', check: s => s.overcharges >= 10, progress: s => ({ current: s.overcharges, target: 10 }) },
    { id: 'shake_master', cat: 'shake', icon: '👑', title: 'Shake Master', desc: 'Соверши 1000 встрясок', check: s => s.totalShakes >= 1000, progress: s => ({ current: s.totalShakes, target: 1000 }) },

    // ---- RARITY ----
    { id: 'first_rare', cat: 'rarity', icon: '🟦', title: 'Первый Rare', desc: 'Получи первый Rare-ответ', check: s => (s.rarityCounts.rare || 0) >= 1 },
    { id: 'first_epic', cat: 'rarity', icon: '🟪', title: 'Первый Epic', desc: 'Получи первый Epic-ответ', check: s => (s.rarityCounts.epic || 0) >= 1 },
    { id: 'first_legendary', cat: 'rarity', icon: '🟨', title: 'Первый Legendary', desc: 'Получи первый Legendary-ответ', check: s => (s.rarityCounts.legendary || 0) >= 1 },
    { id: 'first_mythic', cat: 'rarity', icon: '🌈', title: 'Первый Mythic', desc: 'Получи первый Mythic-ответ', check: s => (s.rarityCounts.mythic || 0) >= 1 },
    { id: 'first_secret', cat: 'rarity', icon: '⬛', title: 'Первый Secret', desc: 'Обнаружь секретную аномалию', check: s => (s.rarityCounts.secret || 0) >= 1 },
    { id: 'five_unique_rare', cat: 'rarity', icon: '🟦', title: '5 разных Rare', desc: 'Найди 5 разных Rare-ответов', check: s => (s.uniqueRare || []).length >= 5, progress: s => ({ current: (s.uniqueRare || []).length, target: 5 }) },
    { id: 'five_unique_epic', cat: 'rarity', icon: '🟪', title: '5 разных Epic', desc: 'Найди 5 разных Epic-ответов', check: s => (s.uniqueEpic || []).length >= 5, progress: s => ({ current: (s.uniqueEpic || []).length, target: 5 }) },
    { id: 'all_legendary', cat: 'rarity', icon: '👑', title: 'Все Legendary', desc: 'Найди все Legendary-ответы', check: s => (s.uniqueLegendary || []).length >= (s.totalLegendaryTexts || 999), progress: s => ({ current: (s.uniqueLegendary || []).length, target: s.totalLegendaryTexts || 0 }) },

    // ---- STREAK ----
    { id: 'streak_3', cat: 'streak', icon: '🔥', title: '3 вопроса подряд', desc: 'Задай 3 вопроса подряд за визит', check: s => s.maxStreak >= 3, progress: s => ({ current: s.maxStreak, target: 3 }) },
    { id: 'streak_5', cat: 'streak', icon: '🔥', title: '5 подряд', desc: 'Задай 5 вопросов подряд', check: s => s.maxStreak >= 5, progress: s => ({ current: s.maxStreak, target: 5 }) },
    { id: 'streak_10', cat: 'streak', icon: '🔥', title: '10 подряд', desc: 'Задай 10 вопросов подряд', check: s => s.maxStreak >= 10, progress: s => ({ current: s.maxStreak, target: 10 }) },
    { id: 'streak_25', cat: 'streak', icon: '🔥', title: '25 подряд', desc: 'Задай 25 вопросов подряд', check: s => s.maxStreak >= 25, progress: s => ({ current: s.maxStreak, target: 25 }) },
    { id: 'streak_50', cat: 'streak', icon: '🔥', title: '50 подряд', desc: 'Задай 50 вопросов подряд', check: s => s.maxStreak >= 50, progress: s => ({ current: s.maxStreak, target: 50 }) },
    { id: 'streak_100', cat: 'streak', icon: '🔥', title: '100 подряд', desc: 'Задай 100 вопросов подряд', check: s => s.maxStreak >= 100, progress: s => ({ current: s.maxStreak, target: 100 }) },

    // ---- DISCOVERY ----
    { id: 'first_theme', cat: 'discovery', icon: '🎨', title: 'Первая тема', desc: 'Открой тему оформления шара', check: s => (s.themesApplied || []).length >= 1 },
    { id: 'five_themes', cat: 'discovery', icon: '🎨', title: '5 тем', desc: 'Опробуй 5 разных тем', check: s => (s.themesApplied || []).length >= 5, progress: s => ({ current: (s.themesApplied || []).length, target: 5 }) },
    { id: 'all_themes', cat: 'discovery', icon: '🎨', title: 'Все темы', desc: 'Опробуй все темы шара', check: s => (s.themesApplied || []).length >= (s.totalThemes || 999), progress: s => ({ current: (s.themesApplied || []).length, target: s.totalThemes || 0 }) },
    { id: 'first_egg', cat: 'discovery', icon: '🥚', title: 'Первый Easter Egg', desc: 'Найди свой первый секрет', check: s => (s.easterEggs || []).length >= 1 },
    { id: 'five_eggs', cat: 'discovery', icon: '🥚', title: '5 Easter Eggs', desc: 'Найди 5 секретов', check: s => (s.easterEggs || []).length >= 5, progress: s => ({ current: (s.easterEggs || []).length, target: 5 }) },
    { id: 'found_secret_answer', cat: 'discovery', icon: '❓', title: 'Аномалия системы', desc: 'Найди Secret-ответ', check: s => (s.rarityCounts.secret || 0) >= 1 },

    // ---- TIME ----
    { id: 'night_prediction', cat: 'time', icon: '🌙', title: 'Ночное предсказание', desc: 'Спроси шар глубокой ночью', check: s => !!s.nightPrediction },
    { id: 'early_prediction', cat: 'time', icon: '🌤️', title: 'Раннее предсказание', desc: 'Спроси шар рано утром', check: s => !!s.earlyPrediction },
    { id: 'midnight', cat: 'time', icon: '🕛', title: 'Полночь', desc: 'Спроси шар ровно в полночь', check: s => !!s.midnightPrediction },
    { id: 'streak_days_7', cat: 'time', icon: '📅', title: '7 дней подряд', desc: 'Используй шар 7 дней подряд', check: s => s.dayStreak >= 7, progress: s => ({ current: s.dayStreak, target: 7 }) },
    { id: 'streak_days_30', cat: 'time', icon: '📅', title: '30 дней подряд', desc: 'Используй шар 30 дней подряд', check: s => s.dayStreak >= 30, progress: s => ({ current: s.dayStreak, target: 30 }) },

    // ---- SECRET (hidden until unlocked) ----
    { id: 'secret_7taps', cat: 'secret', icon: '👁️', title: 'Что-то шевельнулось', desc: 'Ты потревожил шар семь раз подряд.', hidden: true, check: s => (s.easterEggs || []).includes('tap7') },
    { id: 'secret_13taps', cat: 'secret', icon: '🕷️', title: 'Несчастливое число', desc: 'Тринадцать касаний открыли нечто иное.', hidden: true, check: s => (s.easterEggs || []).includes('tap13') },
    { id: 'secret_longpress', cat: 'secret', icon: '🕯️', title: 'Терпение', desc: 'Ты удерживал шар, пока он не ответил.', hidden: true, check: s => (s.easterEggs || []).includes('longpress') },
    { id: 'secret_hundred', cat: 'secret', icon: '💯', title: 'Сотый вопрос', desc: 'Ты задал шару ровно сто вопросов.', hidden: true, check: s => s.totalQuestions >= 100 },
    { id: 'secret_word', cat: 'secret', icon: '🗝️', title: 'Тайное слово', desc: 'Ты произнёс слово, которое шар услышал.', hidden: true, check: s => (s.easterEggs || []).includes('secretword') },
  ];

  function getState() { return MBStorage.get(KEY, { unlocked: {}, unlockedOrder: [] }); }
  function saveState(state) { MBStorage.set(KEY, state); }

  function evaluate(statsSnapshot, onUnlock) {
    const state = getState();
    let changed = false;
    DEFS.forEach(def => {
      if (!state.unlocked[def.id] && def.check(statsSnapshot)) {
        state.unlocked[def.id] = true;
        state.unlockedOrder.push(def.id);
        changed = true;
        if (typeof onUnlock === 'function') onUnlock(def);
      }
    });
    if (changed) saveState(state);
    return state;
  }

  function isUnlocked(id) { return !!getState().unlocked[id]; }
  function unlockedCount() { return Object.keys(getState().unlocked).length; }
  function totalCount() { return DEFS.length; }

  function render(container, statsSnapshot, filterCat) {
    const state = getState();
    container.innerHTML = '';
    const defs = filterCat && filterCat !== 'all' ? DEFS.filter(d => d.cat === filterCat) : DEFS;
    defs.forEach(def => {
      const unlocked = !!state.unlocked[def.id];
      const showHidden = def.hidden && !unlocked;
      const el = document.createElement('div');
      el.className = 'achv-item' + (unlocked ? ' unlocked' : '');
      let progressHtml = '';
      if (!unlocked && !showHidden && typeof def.progress === 'function' && statsSnapshot) {
        const p = def.progress(statsSnapshot);
        if (p && p.target > 0) {
          const pct = Math.min(100, Math.round((p.current / p.target) * 100));
          progressHtml = `
            <div class="achv-progress">
              <div class="achv-progress-track"><div class="achv-progress-fill" style="width:${pct}%"></div></div>
              <span>${Math.min(p.current, p.target)} / ${p.target}</span>
            </div>`;
        }
      }
      el.innerHTML = `
        <div class="achv-icon">${unlocked ? def.icon : (showHidden ? '❓' : '🔒')}</div>
        <div class="achv-body">
          <div class="achv-title">${showHidden ? '???' : def.title}</div>
          <div class="achv-desc">${showHidden ? 'Это достижение скрыто.' : def.desc}</div>
          ${progressHtml}
        </div>
      `;
      container.appendChild(el);
    });
  }

  function renderFilters(container, onChange) {
    const cats = ['all', ...CATEGORIES];
    container.innerHTML = '';
    cats.forEach((cat, i) => {
      const chip = document.createElement('button');
      chip.className = 'filter-chip' + (i === 0 ? ' active' : '');
      chip.textContent = cat === 'all' ? 'Все' : CATEGORY_LABELS[cat];
      chip.addEventListener('click', () => {
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        onChange(cat);
      });
      container.appendChild(chip);
    });
  }

  global.MBAchievements = { DEFS, CATEGORIES, CATEGORY_LABELS, evaluate, isUnlocked, unlockedCount, totalCount, render, renderFilters, getState };
})(window);
