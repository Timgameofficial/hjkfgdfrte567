/* progression.js — Magic XP/Levels, "connection with the ball", Daily Prophecy */
(function (global) {
  const KEY = 'mb_progression';

  function getState() {
    return MBStorage.get(KEY, { xp: 0, interactions: 0, daily: null });
  }
  function saveState(s) { MBStorage.set(KEY, s); }

  // ---- XP / Levels ----
  const LEVEL_TITLES = [
    { level: 1, title: 'Curious' },
    { level: 2, title: 'Seeker' },
    { level: 3, title: 'Apprentice' },
    { level: 4, title: 'Mystic' },
    { level: 5, title: 'Oracle' },
    { level: 10, title: 'Magician' },
    { level: 20, title: 'Seer' },
    { level: 50, title: 'Archoracle' }
  ];

  function xpForLevel(level) { return Math.round(50 * Math.pow(level, 1.5)); }

  function levelFromXp(xp) {
    let level = 1;
    while (xp >= xpForLevel(level + 1) && level < 99) level++;
    return level;
  }

  function titleForLevel(level) {
    let title = LEVEL_TITLES[0].title;
    for (const entry of LEVEL_TITLES) {
      if (level >= entry.level) title = entry.title; else break;
    }
    return title;
  }

  function addXP(amount, onLevelUp) {
    const s = getState();
    const prevLevel = levelFromXp(s.xp);
    s.xp += amount;
    const newLevel = levelFromXp(s.xp);
    saveState(s);
    if (newLevel > prevLevel && typeof onLevelUp === 'function') {
      onLevelUp({ level: newLevel, title: titleForLevel(newLevel) });
    }
    return s.xp;
  }

  function getXpProgress() {
    const s = getState();
    const level = levelFromXp(s.xp);
    const base = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const pct = Math.max(0, Math.min(1, (s.xp - base) / (next - base)));
    return { xp: s.xp, level, title: titleForLevel(level), base, next, pct };
  }

  // ---- Connection level (purely decorative) ----
  const CONNECTION_TIERS = [
    { min: 0, label: 'Незнакомец' },
    { min: 10, label: 'Знакомый' },
    { min: 50, label: 'Искатель' },
    { min: 100, label: 'Посвящённый' },
    { min: 500, label: 'Избранный' },
    { min: 1000, label: 'Связь установлена' }
  ];

  function registerInteraction() {
    const s = getState();
    s.interactions = (s.interactions || 0) + 1;
    saveState(s);
    return s.interactions;
  }
  function getConnection() {
    const s = getState();
    const interactions = s.interactions || 0;
    let label = CONNECTION_TIERS[0].label;
    let nextTier = CONNECTION_TIERS[1];
    for (let i = 0; i < CONNECTION_TIERS.length; i++) {
      if (interactions >= CONNECTION_TIERS[i].min) {
        label = CONNECTION_TIERS[i].label;
        nextTier = CONNECTION_TIERS[i + 1] || null;
      }
    }
    return { interactions, label, nextTier };
  }

  // ---- Daily Prophecy + Luck of the Day (decorative, deterministic per day) ----
  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
    return h;
  }

  function getDailyStatus() {
    const s = getState();
    const today = todayKey();
    if (s.daily && s.daily.date === today) return { claimed: true, ...s.daily };
    return { claimed: false, date: today };
  }

  function claimDailyProphecy(answerObj) {
    const s = getState();
    const today = todayKey();
    if (s.daily && s.daily.date === today) return { claimed: true, ...s.daily };
    const luckSeed = hashString(today + '-luck');
    const luck = 30 + (luckSeed % 71); // 30–100, always feels decent
    s.daily = { date: today, answer: answerObj.text, rarity: answerObj.rarity, luck };
    saveState(s);
    return { claimed: true, ...s.daily };
  }

  global.MBProgression = {
    addXP, getXpProgress, titleForLevel, levelFromXp,
    registerInteraction, getConnection,
    getDailyStatus, claimDailyProphecy
  };
})(window);
