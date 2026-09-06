/* signs.js — collectible symbolic system ("Знаки"). Data-driven, same shape
   as achievements.js on purpose: one place defines id/name/rarity/description/
   icon/discovery_condition, evaluate() checks them against a shared context
   object built once per reveal in app.js, render() draws the collection grid.
   Kept as its own module (not folded into achievements.js) because signs are
   a distinct collectible layer with their own UI ("SIGNS X / N"), not a
   progress/unlock log. */
(function (global) {
  const KEY = 'mb_signs';

  const RARITIES = ['common', 'rare', 'epic', 'legendary', 'secret'];

  // ctx fields used below (all optional/defensive): rarity, category, stats,
  // memory {isRepeat, repeatCount, similarPrior}, connection {interactions},
  // xp {level}, hour (0-23), overcharge, perfect, secretEventId
  const SIGNS = [
    {
      id: 'eye', name: 'EYE', icon: '👁️', rarity: 'rare',
      description: 'Открывается, когда шар показывает Secret-ответ.',
      discover: ctx => ctx.rarity === 'secret'
    },
    {
      id: 'moon', name: 'MOON', icon: '🌙', rarity: 'common',
      description: 'Открывается за вопрос глубокой ночью (0:00–5:00).',
      discover: ctx => ctx.hour >= 0 && ctx.hour < 5
    },
    {
      id: 'key', name: 'KEY', icon: '🗝️', rarity: 'rare',
      description: 'Открывается после 5 разблокированных достижений.',
      discover: ctx => ctx.achievementsUnlockedCount >= 5
    },
    {
      id: 'star', name: 'STAR', icon: '⭐', rarity: 'epic',
      description: 'Открывается на первом Mythic-ответе.',
      discover: ctx => ctx.rarity === 'mythic'
    },
    {
      id: 'flame', name: 'FLAME', icon: '🔥', rarity: 'common',
      description: 'Открывается за серию из 10 вопросов подряд.',
      discover: ctx => (ctx.stats.maxStreak || 0) >= 10
    },
    {
      id: 'snake', name: 'SNAKE', icon: '🐍', rarity: 'rare',
      description: 'Открывается, если задать один и тот же вопрос трижды.',
      discover: ctx => ctx.memory && ctx.memory.repeatCount >= 3
    },
    {
      id: 'crown', name: 'CROWN', icon: '👑', rarity: 'epic',
      description: 'Открывается на 10 уровне.',
      discover: ctx => (ctx.xp && ctx.xp.level) >= 10
    },
    {
      id: 'clock', name: 'CLOCK', icon: '🕛', rarity: 'legendary',
      description: 'Открывается, если спросить шар ровно в полночь.',
      discover: ctx => !!ctx.stats.midnightPrediction
    },
    {
      id: 'wing', name: 'WING', icon: '🕊️', rarity: 'epic',
      description: 'Открывается за 7-дневную серию использования.',
      discover: ctx => (ctx.stats.dayStreak || 0) >= 7
    },
    {
      id: 'skull', name: 'SKULL', icon: '💀', rarity: 'rare',
      description: 'Открывается за 10 перезарядок шара (overcharge).',
      discover: ctx => (ctx.stats.overcharges || 0) >= 10
    },
    {
      id: 'orbit', name: 'ORBIT', icon: '🪐', rarity: 'common',
      description: 'Открывается за 3 разных дня использования.',
      discover: ctx => (ctx.stats.daysUsed || []).length >= 3
    },
    {
      id: 'void', name: 'VOID', icon: '🕳️', rarity: 'secret',
      description: 'Скрытый знак. Условие неизвестно.',
      hidden: true,
      discover: ctx => ctx.secretEventId === 'void'
    },
    {
      id: 'sun', name: 'SUN', icon: '🌤️', rarity: 'common',
      description: 'Открывается за вопрос рано утром (5:00–8:00).',
      discover: ctx => ctx.hour >= 5 && ctx.hour < 8
    },
    {
      id: 'mask', name: 'MASK', icon: '🎭', rarity: 'rare',
      description: 'Открывается после 5 опробованных тем оформления.',
      discover: ctx => (ctx.stats.themesApplied || []).length >= 5
    },
    {
      id: 'comet', name: 'COMET', icon: '☄️', rarity: 'epic',
      description: 'Открывается за идеальную встряску (Perfect Shake).',
      discover: ctx => !!ctx.perfect
    }
  ];

  function defaultState() { return { discovered: {}, order: [] }; }
  function getState() { return MBStorage.getMerged(KEY, defaultState()); }
  function saveState(s) { MBStorage.set(KEY, s); }

  function evaluate(ctx) {
    const state = getState();
    const newly = [];
    SIGNS.forEach(sign => {
      if (!state.discovered[sign.id] && sign.discover(ctx)) {
        state.discovered[sign.id] = true;
        state.order.push(sign.id);
        newly.push(sign);
      }
    });
    if (newly.length) saveState(state);
    return newly;
  }

  function discoveredCount() { return Object.keys(getState().discovered).length; }
  function totalCount() { return SIGNS.length; }

  function render(container) {
    const state = getState();
    container.innerHTML = '';
    container.setAttribute('role', 'list');
    container.setAttribute('aria-label', `Знаки: ${discoveredCount()} из ${totalCount()} открыто`);
    SIGNS.forEach(sign => {
      const found = !!state.discovered[sign.id];
      const el = document.createElement('div');
      el.className = 'sign-tile' + (found ? ' found' : '');
      el.setAttribute('role', 'listitem');
      el.setAttribute('aria-label', found ? `${sign.name}: ${sign.description}` : 'Знак ещё не открыт');
      el.title = found ? (sign.name + ' — ' + sign.description) : 'Знак ещё не открыт';
      el.innerHTML = `
        <div class="sign-icon" aria-hidden="true">${found ? sign.icon : '❔'}</div>
        <div class="sign-name">${found ? sign.name : '???'}</div>
      `;
      container.appendChild(el);
    });
  }

  global.MBSigns = { SIGNS, RARITIES, evaluate, discoveredCount, totalCount, render, getState };
})(window);
