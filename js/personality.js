/* personality.js — makes the Ball feel like it has a subtle personality.
   Data-driven trigger/priority/cooldown/message shape, same reasoning as
   achievements.js/signs.js. Replaces the old ad-hoc totalQuestions-only
   check that used to live in app.js (avoids scattering this kind of logic
   across the reveal pipeline). Only ONE line is picked per reveal, and a
   short global cooldown prevents back-to-back chatter — the personality
   should feel occasional, not constant (avoid_constant_dialogue). */
(function (global) {
  const KEY = 'mb_personality';
  const GLOBAL_COOLDOWN_MS = 8000;

  function defaultState() { return { shown: {}, lastTriggered: {}, lastShownDate: {}, lastGlobal: 0 }; }
  function getState() { return MBStorage.getMerged(KEY, defaultState()); }
  function saveState(s) { MBStorage.set(KEY, s); }

  // ctx fields used: stats, memory {repeatCount}, rarity, hour (0-23),
  // consecutiveOvercharges, connection {label}, connectionTierChanged,
  // secretEvent (id of any secret event that already fired this reveal, so
  // lines can avoid piling on top of it)
  const LINES = [
    { id: 'first_visit', trigger: 'first_visit', priority: 100, once: true,
      condition: ctx => ctx.stats.totalQuestions === 1,
      message: () => 'Мы только познакомились.' },
    { id: 'q5', trigger: 'question_count', priority: 90, once: true,
      condition: ctx => ctx.stats.totalQuestions === 5,
      message: () => 'Мы снова встретились.' },
    { id: 'q10', trigger: 'question_count', priority: 90, once: true,
      condition: ctx => ctx.stats.totalQuestions === 10,
      message: () => 'Ты опять здесь.' },
    { id: 'q25', trigger: 'question_count', priority: 90, once: true,
      condition: ctx => ctx.stats.totalQuestions === 25,
      message: () => 'Я начинаю тебя узнавать.' },
    { id: 'q50', trigger: 'question_count', priority: 90, once: true,
      condition: ctx => ctx.stats.totalQuestions === 50,
      message: () => 'Ты задаёшь слишком много вопросов.' },
    { id: 'q100', trigger: 'question_count', priority: 90, once: true,
      condition: ctx => ctx.stats.totalQuestions === 100,
      message: () => 'Сто вопросов. Я запомнил каждый.' },

    { id: 'connection_up', trigger: 'connection_level', priority: 95,
      condition: ctx => !!ctx.connectionTierChanged,
      message: ctx => `Теперь наша связь: ${ctx.connection.label}.` },

    { id: 'secret_rarity', trigger: 'rarity', priority: 85, cooldownMs: 30000,
      condition: ctx => ctx.rarity === 'secret',
      message: () => 'Мы не должны были это увидеть.' },

    { id: 'repeated_question', trigger: 'repeated_question', priority: 70, cooldownMs: 60000,
      condition: ctx => ctx.memory && ctx.memory.repeatCount >= 2 && !ctx.secretEvent,
      message: () => 'Ты уже спрашивал это.' },

    { id: 'intensity', trigger: 'interaction_intensity', priority: 65, cooldownMs: 120000,
      condition: ctx => (ctx.consecutiveOvercharges || 0) >= 3,
      message: () => 'Полегче.' },

    { id: 'streak5', trigger: 'streak', priority: 60, cooldownMs: 600000,
      condition: ctx => ctx.stats.sessionStreak === 5,
      message: () => 'Ты не останавливаешься.' },
    { id: 'streak10', trigger: 'streak', priority: 60, cooldownMs: 600000,
      condition: ctx => ctx.stats.sessionStreak === 10,
      message: () => 'Десять подряд. Впечатляет.' },

    { id: 'rare_pull', trigger: 'rarity', priority: 50, cooldownMs: 30000,
      condition: ctx => ['epic', 'legendary', 'mythic'].indexOf(ctx.rarity) !== -1 && !ctx.secretEvent,
      message: () => '...любопытно.' },

    { id: 'night_owl', trigger: 'time_of_day', priority: 40, oncePerDay: true,
      condition: ctx => ctx.hour >= 0 && ctx.hour < 5,
      message: () => 'Ты спрашиваешь лучше по ночам.' },
    { id: 'early_bird', trigger: 'time_of_day', priority: 40, oncePerDay: true,
      condition: ctx => ctx.hour >= 5 && ctx.hour < 8,
      message: () => 'Раннее утро — редкое время для вопросов.' }
  ];

  function pick(ctx) {
    const state = getState();
    const now = Date.now();
    if (now - (state.lastGlobal || 0) < GLOBAL_COOLDOWN_MS) return null;
    const today = global.MBDate ? global.MBDate.todayKey() : '';

    for (const line of LINES.slice().sort((a, b) => b.priority - a.priority)) {
      if (line.once && state.shown[line.id]) continue;
      if (line.oncePerDay && (state.lastShownDate || {})[line.id] === today) continue;
      if (line.cooldownMs) {
        const last = (state.lastTriggered || {})[line.id] || 0;
        if (now - last < line.cooldownMs) continue;
      }
      if (!line.condition(ctx)) continue;

      state.lastGlobal = now;
      if (line.once) state.shown[line.id] = true;
      if (line.oncePerDay) { state.lastShownDate = state.lastShownDate || {}; state.lastShownDate[line.id] = today; }
      if (line.cooldownMs) { state.lastTriggered = state.lastTriggered || {}; state.lastTriggered[line.id] = now; }
      saveState(state);
      return { id: line.id, message: line.message(ctx) };
    }
    return null;
  }

  global.MBPersonality = { LINES, pick };
})(window);
