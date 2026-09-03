/* achievements.js — v2.0: 30 achievements across usage, rarity, shake-skill,
   time-of-day, and progression categories. */
(function (global) {
  const KEY = 'mb_achievements';

  const DEFS = [
    // usage volume
    { id: 'first_question', icon: '🔮', title: 'Первое предсказание', desc: 'Задай свой первый вопрос', check: s => s.totalQuestions >= 1 },
    { id: 'ten_questions', icon: '🔮', title: 'Начинающий маг', desc: 'Задай 10 вопросов', check: s => s.totalQuestions >= 10 },
    { id: 'fifty_questions', icon: '🔮', title: 'Провидец', desc: 'Задай 50 вопросов', check: s => s.totalQuestions >= 50 },
    { id: 'hundred_questions', icon: '🔮', title: 'Оракул', desc: 'Задай 100 вопросов', check: s => s.totalQuestions >= 100 },
    { id: 'thousand_questions', icon: '👑', title: 'Хранитель шара', desc: 'Задай 1000 вопросов', check: s => s.totalQuestions >= 1000 },
    // rarity firsts
    { id: 'first_uncommon', icon: '💠', title: 'Первый проблеск', desc: 'Получи Uncommon ответ', check: s => (s.rarityCounts.uncommon || 0) >= 1 },
    { id: 'first_rare', icon: '💎', title: 'Первый Rare', desc: 'Получи Rare ответ', check: s => (s.rarityCounts.rare || 0) >= 1 },
    { id: 'first_epic', icon: '🟣', title: 'Первый Epic', desc: 'Получи Epic ответ', check: s => (s.rarityCounts.epic || 0) >= 1 },
    { id: 'first_legendary', icon: '✨', title: 'Избранный', desc: 'Получи Legendary ответ', check: s => (s.rarityCounts.legendary || 0) >= 1 },
    { id: 'first_mythic', icon: '🌌', title: 'Мифический миг', desc: 'Получи Mythic ответ', check: s => (s.rarityCounts.mythic || 0) >= 1 },
    { id: 'first_secret', icon: '🕳️', title: 'То, чего не должно быть', desc: 'Найди секретный ответ', check: s => (s.rarityCounts.secret || 0) >= 1 },
    { id: 'five_legendary', icon: '🏆', title: 'Коллекционер судеб', desc: 'Получи 5 Legendary ответов', check: s => (s.rarityCounts.legendary || 0) >= 5 },
    // streak / combo
    { id: 'streak_ten', icon: '🔥', title: 'Неугомонный', desc: 'Задай 10 вопросов подряд за один визит', check: s => s.maxStreak >= 10 },
    { id: 'streak_twentyfive', icon: '🔥', title: 'На волне', desc: '25 предсказаний подряд', check: s => s.maxStreak >= 25 },
    { id: 'combo_best_ten', icon: '🔗', title: 'Связь установлена', desc: 'Достигни серии из 10', check: s => (s.comboBest || 0) >= 10 },
    // patterns
    { id: 'coincidence', icon: '🌀', title: 'Совпадение?', desc: 'Получи один и тот же ответ несколько раз', check: s => s.repeatedAnswerHits >= 3 },
    { id: 'same_type_five', icon: '📎', title: 'Постоянство', desc: 'Получи один тип ответа 5 раз подряд по категории', check: s => (s.sameCategoryStreak || 0) >= 5 },
    // shake skill
    { id: 'perfect_shake', icon: '🎯', title: 'Идеальная встряска', desc: 'Сделай идеальную встряску', check: s => (s.perfectShakes || 0) >= 1 },
    { id: 'overcharge', icon: '⚡', title: 'Энергия превышена', desc: 'Перегрузи шар встряской', check: s => (s.overcharges || 0) >= 1 },
    { id: 'calm_shake', icon: '🕊️', title: 'Тихий вопрос', desc: 'Сделай очень мягкую встряску', check: s => (s.calmShakes || 0) >= 1 },
    { id: 'extreme_ten', icon: '💥', title: 'Экстремал', desc: '10 экстремальных встряхиваний', check: s => (s.extremeShakes || 0) >= 10 },
    // time-based
    { id: 'night_prediction', icon: '🌙', title: 'Ночное предсказание', desc: 'Получи ответ после полуночи', check: s => !!s.hadNightPrediction },
    { id: 'daily_streak_seven', icon: '📅', title: 'Неделя веры', desc: 'Заходи 7 дней подряд', check: s => (s.daysUsed || []).length >= 7 },
    { id: 'fifty_in_a_day', icon: '📈', title: 'Одержимость', desc: '50 вопросов за один день', check: s => (s.maxQuestionsInDay || 0) >= 50 },
    // categories
    { id: 'romantic_lover', icon: '💘', title: 'Романтик', desc: '10 романтических ответов', check: s => (s.categoryCounts.romantic || 0) >= 10 },
    { id: 'dark_seeker', icon: '🕯️', title: 'Искатель тьмы', desc: '10 тёмных ответов', check: s => (s.categoryCounts.dark || 0) >= 10 },
    { id: 'wisdom_seeker', icon: '📖', title: 'Мудрец', desc: '10 ответов мудрости', check: s => (s.categoryCounts.wisdom || 0) >= 10 },
    // themes / meta
    { id: 'theme_switcher', icon: '🎨', title: 'Стиль решает всё', desc: 'Смени тему оформления', check: s => !!s.themeSwitched },
    { id: 'pwa_install', icon: '📲', title: 'На главном экране', desc: 'Установи приложение и получи первое предсказание', check: s => !!s.pwaFirstPrediction },
    { id: 'daily_prophecy', icon: '☀️', title: 'Предсказание дня', desc: 'Получи предсказание дня', check: s => !!s.claimedDaily },
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

  function render(container) {
    const state = getState();
    container.innerHTML = '';
    const unlockedCount = DEFS.filter(d => state.unlocked[d.id]).length;
    const summary = document.createElement('div');
    summary.className = 'achv-summary';
    summary.textContent = `${unlockedCount} / ${DEFS.length} открыто`;
    container.appendChild(summary);
    DEFS.forEach(def => {
      const unlocked = !!state.unlocked[def.id];
      const el = document.createElement('div');
      el.className = 'achv-item' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `
        <div class="achv-icon">${unlocked ? def.icon : '🔒'}</div>
        <div>
          <div class="achv-title">${def.title}</div>
          <div class="achv-desc">${def.desc}</div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  global.MBAchievements = { DEFS, evaluate, isUnlocked, render, getState };
})(window);
