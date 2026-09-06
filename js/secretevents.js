/* secretevents.js — reusable rare-event engine ("original_mechanics": resonance,
   omen, fracture, echo, void, lucky_moment, memory_fragment, unanswered,
   paradox, question_100). Deliberately UI-agnostic: this module only decides
   WHICH event (if any) fires for a given reveal and returns a small
   serializable payload — app.js is the only place that turns that into an
   actual visual/audio effect or altered answer text. Keeps the "what counts
   as rare" logic in one place instead of scattered across the reveal
   pipeline, per the "reusable engine" / "don't scatter egg logic" rule.

   Only ONE event fires per reveal (whichever matches first, in priority
   order), and a global cooldown keeps them from ever stacking — the whole
   point of these is that they should feel rare, not routine. */
(function (global) {
  const KEY = 'mb_secretevents';
  const GLOBAL_COOLDOWN_MS = 25000;      // never two secret events within 25s of each other
  const DEFAULT_COOLDOWN_MS = 90000;     // default per-event repeat cooldown
  const LONG_COOLDOWN_MS = 5 * 60 * 1000; // for the "extremely rare" ones

  function defaultState() { return { lastGlobal: 0, lastTriggered: {}, once: {}, omens: [] }; }
  function getState() { return MBStorage.getMerged(KEY, defaultState()); }
  function saveState(s) { MBStorage.set(KEY, s); }

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
  function rarityAtLeast(rarity, min) { return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(min); }

  // Each def: id, name, priority (higher checked first), once (bool),
  // cooldownMs (repeat throttle, ignored if once), condition(ctx) -> bool.
  // `condition` already embeds the "how rare" logic (a fixed situational
  // gate, sometimes combined with Math.random() for the truly rare ones).
  const DEFS = [
    {
      id: 'question_100', name: 'Сотый вопрос', priority: 100, once: true,
      condition: ctx => ctx.stats.totalQuestions === 100
    },
    {
      id: 'void', name: 'Пустота', priority: 90, cooldownMs: LONG_COOLDOWN_MS,
      // an empty (purely mental) question released with an overcharge shake —
      // a deliberately unusual combination to stumble into
      condition: ctx => !ctx.qNorm && ctx.overcharge
    },
    {
      id: 'unanswered', name: 'Без ответа', priority: 80, cooldownMs: LONG_COOLDOWN_MS,
      condition: ctx => ctx.stats.totalQuestions >= 5 && Math.random() < 0.006
    },
    {
      id: 'fracture', name: 'Трещина', priority: 70, cooldownMs: LONG_COOLDOWN_MS,
      condition: ctx => rarityAtLeast(ctx.rarity, 'epic') && Math.random() < 0.05
    },
    {
      id: 'paradox', name: 'Парадокс', priority: 60, cooldownMs: DEFAULT_COOLDOWN_MS,
      condition: ctx => ctx.memory && ctx.memory.isRepeat && ctx.memory.priorCategory &&
        ((ctx.memory.priorCategory === 'positive' && ctx.category === 'negative') ||
         (ctx.memory.priorCategory === 'negative' && ctx.category === 'positive'))
    },
    {
      id: 'echo', name: 'Эхо', priority: 50, cooldownMs: DEFAULT_COOLDOWN_MS,
      condition: ctx => ctx.memory && ctx.memory.isRepeat && ctx.memory.repeatCount === 2
    },
    {
      id: 'resonance', name: 'Резонанс', priority: 40, cooldownMs: DEFAULT_COOLDOWN_MS,
      condition: ctx => ctx.overcharge && (ctx.stats.sessionStreak || 0) >= 3
    },
    {
      id: 'memory_fragment', name: 'Осколок памяти', priority: 30, cooldownMs: DEFAULT_COOLDOWN_MS,
      condition: ctx => !!ctx.pastEntry && Math.random() < 0.08
    },
    {
      id: 'lucky_moment', name: 'Удачный момент', priority: 20, cooldownMs: DEFAULT_COOLDOWN_MS,
      condition: ctx => ctx.category === 'positive' && Math.random() < 0.05
    },
    {
      id: 'omen', name: 'Знамение', priority: 10, cooldownMs: DEFAULT_COOLDOWN_MS,
      condition: ctx => rarityAtLeast(ctx.rarity, 'rare') && Math.random() < 0.04
    }
  ];

  // returns the picked def (plus useful derived data) or null
  function evaluate(ctx) {
    const state = getState();
    const now = Date.now();
    if (now - (state.lastGlobal || 0) < GLOBAL_COOLDOWN_MS) return null;

    for (const def of DEFS.slice().sort((a, b) => b.priority - a.priority)) {
      if (def.once && state.once[def.id]) continue;
      if (!def.once) {
        const last = (state.lastTriggered || {})[def.id] || 0;
        if (now - last < (def.cooldownMs || DEFAULT_COOLDOWN_MS)) continue;
      }
      if (!def.condition(ctx)) continue;

      // matched — commit cooldown/once state and return
      state.lastGlobal = now;
      if (def.once) state.once[def.id] = true;
      else { state.lastTriggered = state.lastTriggered || {}; state.lastTriggered[def.id] = now; }

      if (def.id === 'omen') {
        state.omens = state.omens || [];
        state.omens.unshift({ text: ctx.answerObj.text, rarity: ctx.rarity, at: now });
        if (state.omens.length > 50) state.omens.length = 50;
      }
      saveState(state);
      return { id: def.id, name: def.name };
    }
    return null;
  }

  function getOmens() { return getState().omens || []; }

  global.MBSecretEvents = { DEFS, evaluate, getOmens };
})(window);
