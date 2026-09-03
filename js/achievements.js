/* achievements.js — achievement definitions, progress tracking & unlocking */
(function (global) {
  const KEY = 'mb_achievements';

  const DEFS = [
    { id: 'first_question', icon: '🔮', title: 'Первое предсказание', desc: 'Задай свой первый вопрос', check: s => s.totalQuestions >= 1 },
    { id: 'ten_questions', icon: '🔮', title: 'Начинающий маг', desc: 'Задай 10 вопросов', check: s => s.totalQuestions >= 10 },
    { id: 'fifty_questions', icon: '🔮', title: 'Провидец', desc: 'Задай 50 вопросов', check: s => s.totalQuestions >= 50 },
    { id: 'hundred_questions', icon: '🔮', title: 'Оракул', desc: 'Задай 100 вопросов', check: s => s.totalQuestions >= 100 },
    { id: 'legendary', icon: '✨', title: 'Избранный', desc: 'Получи Legendary ответ', check: s => s.legendaryCount >= 1 },
    { id: 'streak_ten', icon: '🔥', title: 'Неугомонный', desc: 'Задай 10 вопросов подряд за один визит', check: s => s.maxStreak >= 10 },
    { id: 'coincidence', icon: '🌀', title: 'Совпадение?', desc: 'Получи один и тот же ответ несколько раз', check: s => s.repeatedAnswerHits >= 3 },
  ];

  function getState() {
    return MBStorage.get(KEY, { unlocked: {}, unlockedOrder: [] });
  }
  function saveState(state) {
    MBStorage.set(KEY, state);
  }

  // stats used purely for achievement checks are read from MBStats
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

  function isUnlocked(id) {
    const state = getState();
    return !!state.unlocked[id];
  }

  function render(container) {
    const state = getState();
    container.innerHTML = '';
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
