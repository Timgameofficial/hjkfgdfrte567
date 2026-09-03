/* energy.js — v2.0 progression: MAGIC ENERGY meter, combo/streak, luck,
   daily prophecy, and "the ball remembers you" milestone messages. */
(function (global) {
  const ENERGY_KEY = 'mb_energy';
  const COMBO_KEY = 'mb_combo';
  const DAILY_KEY = 'mb_daily';

  // ---- MAGIC ENERGY (0-100, visual only, never a paid resource) ----
  function getEnergy() { return MBStorage.get(ENERGY_KEY, 22); }
  function setEnergy(v) { MBStorage.set(ENERGY_KEY, Math.max(0, Math.min(100, v))); }

  function chargeEnergy(amount) {
    const v = getEnergy() + amount;
    setEnergy(v);
    return getEnergy();
  }

  // gentle passive settle toward a resting band after a prediction
  function stabilizeEnergy() {
    const v = getEnergy();
    const target = 20 + Math.random() * 12;
    setEnergy(v + (target - v) * 0.4);
  }

  function energyTier(v) {
    if (v < 30) return 'calm';
    if (v < 60) return 'active';
    if (v < 90) return 'strong';
    return 'overload';
  }

  // ---- COMBO / STREAK (session-scoped, resets after inactivity) ----
  const COMBO_TIMEOUT_MS = 90000;
  function getCombo() { return MBStorage.get(COMBO_KEY, { count: 0, last: 0, best: 0 }); }
  function saveCombo(c) { MBStorage.set(COMBO_KEY, c); }

  function bumpCombo() {
    const c = getCombo();
    const now = Date.now();
    if (now - c.last > COMBO_TIMEOUT_MS) c.count = 0;
    c.count++;
    c.last = now;
    c.best = Math.max(c.best, c.count);
    saveCombo(c);
    return c;
  }
  function comboMessage(count) {
    if (count === 3) return 'Связь установлена 🔗';
    if (count === 5) return 'Шар начинает тебя узнавать 👁️';
    if (count === 10) return 'Между вами что-то особенное ✨';
    if (count > 0 && count % 15 === 0) return `Серия ${count} — шар впечатлён.`;
    return null;
  }

  // ---- LUCK (derived, affects rarity odds only — no bets, no money) ----
  function computeLuck() {
    const combo = getCombo();
    const stats = MBStorage.get('mb_stats', { totalQuestions: 0, maxStreak: 0 });
    const daily = getDaily();
    let luck = 0;
    luck += Math.min(0.25, combo.count * 0.02);
    luck += Math.min(0.15, (stats.totalQuestions || 0) * 0.0008);
    luck += daily.claimedToday ? 0.08 : 0;
    luck += Math.random() * 0.1; // small unpredictable variance
    return Math.max(0, Math.min(0.5, luck));
  }

  // ---- MILESTONE MESSAGES ("the ball remembers you") ----
  function milestoneMessage(totalQuestions) {
    if (totalQuestions === 20) return 'Я уже начинаю понимать тебя...';
    if (totalQuestions === 50) return 'Ты часто задаёшь мне вопросы.';
    if (totalQuestions === 100) return 'Ты веришь мне больше, чем следовало бы.';
    if (totalQuestions === 250) return 'Мы прошли через многое вместе.';
    if (totalQuestions === 500) return 'Ты и я — это уже традиция.';
    return null;
  }

  // ---- DAILY PROPHECY ----
  function getDaily() {
    return MBStorage.get(DAILY_KEY, { date: null, text: null, claimedToday: false });
  }
  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function claimDailyProphecy(getAnswerFn) {
    const d = getDaily();
    const today = todayKey();
    if (d.date === today) {
      return { ...d, claimedToday: true, isNew: false };
    }
    const answer = getAnswerFn();
    const record = { date: today, text: answer.text, rarity: answer.rarity, claimedToday: true };
    MBStorage.set(DAILY_KEY, record);
    return { ...record, isNew: true };
  }

  function hasClaimedToday() {
    return getDaily().date === todayKey();
  }

  global.MBEnergy = {
    getEnergy, setEnergy, chargeEnergy, stabilizeEnergy, energyTier,
    bumpCombo, getCombo, comboMessage,
    computeLuck,
    milestoneMessage,
    claimDailyProphecy, hasClaimedToday, getDaily
  };
})(window);
