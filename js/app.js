/* app.js — orchestrates the whole V2 experience: shake engine, physics, cinematic
   reveal, rarity/XP/achievements, daily prophecy, easter eggs, settings, debug panel. */
(function () {
  const $ = (id) => document.getElementById(id);

  const app = $('app');
  const ballWrap = $('ball-wrap');
  const ballText = $('ball-text');
  const rarityLabel = $('rarity-label');
  const questionInput = $('question-input');
  const askBtn = $('ask-btn');
  const manualShakeBtn = $('manual-shake-btn');
  const hintLine1 = $('hint-line-1');
  const hintLine2 = $('hint-line-2');
  const resultActions = $('result-actions');
  const streakPill = $('streak-pill');

  let isRevealing = false;
  let audioUnlockedOnce = false;
  let motionPermissionResolved = false;
  let idleTimer = null;
  let lastShakeTickFx = 0;
  let chargeAudioActive = false;

  const settings = {
    cinematic: MBStorage.get('mb_cinematic', true),
    fastMode: MBStorage.get('mb_fastmode', false),
    gameMode: MBStorage.get('mb_gamemode', 'classic')
  };

  // ===================== STATS =====================
  const STATS_KEY = 'mb_stats';
  function defaultStats() {
    return {
      totalQuestions: 0,
      categoryCounts: { positive: 0, negative: 0, neutral: 0, funny: 0, mystic: 0 },
      rarityCounts: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, secret: 0 },
      uniqueRare: [], uniqueEpic: [], uniqueLegendary: [],
      daysUsed: [], dayStreak: 0,
      sessionStreak: 0, maxStreak: 0,
      totalShakes: 0, perfectShakes: 0, overcharges: 0,
      themesApplied: [],
      easterEggs: [],
      nightPrediction: false, earlyPrediction: false, midnightPrediction: false,
      recentTexts: []
    };
  }
  function getStats() { return MBStorage.get(STATS_KEY, defaultStats()); }
  function saveStats(s) { MBStorage.set(STATS_KEY, s); }

  function computeDayStreak(daysUsed) {
    const set = new Set(daysUsed);
    let streak = 0;
    let d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (set.has(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    return streak;
  }

  function recordAnswer(answerObj, shakeIntensity) {
    const s = getStats();
    s.totalQuestions++;
    s.categoryCounts[answerObj.category] = (s.categoryCounts[answerObj.category] || 0) + 1;
    s.rarityCounts[answerObj.rarity] = (s.rarityCounts[answerObj.rarity] || 0) + 1;

    if (answerObj.rarity === 'rare' && !s.uniqueRare.includes(answerObj.text)) s.uniqueRare.push(answerObj.text);
    if (answerObj.rarity === 'epic' && !s.uniqueEpic.includes(answerObj.text)) s.uniqueEpic.push(answerObj.text);
    if (answerObj.rarity === 'legendary' && !s.uniqueLegendary.includes(answerObj.text)) s.uniqueLegendary.push(answerObj.text);

    const today = new Date().toISOString().slice(0, 10);
    if (!s.daysUsed.includes(today)) s.daysUsed.push(today);
    s.dayStreak = computeDayStreak(s.daysUsed);

    s.sessionStreak++;
    s.maxStreak = Math.max(s.maxStreak, s.sessionStreak);

    s.recentTexts.unshift(answerObj.text);
    if (s.recentTexts.length > 6) s.recentTexts.length = 6;

    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) s.nightPrediction = true;
    if (hour >= 5 && hour < 8) s.earlyPrediction = true;
    if (hour === 0) s.midnightPrediction = true;

    saveStats(s);
    return s;
  }

  function recordShake({ perfect, overcharge }) {
    const s = getStats();
    s.totalShakes++;
    if (perfect) s.perfectShakes++;
    saveStats(s);
    return s;
  }
  function recordOvercharge() {
    const s = getStats();
    s.overcharges++;
    saveStats(s);
    return s;
  }
  function recordThemeApplied(id) {
    const s = getStats();
    if (!s.themesApplied.includes(id)) s.themesApplied.push(id);
    saveStats(s);
    return s;
  }
  function recordEasterEgg(id) {
    const s = getStats();
    if (!s.easterEggs.includes(id)) {
      s.easterEggs.push(id);
      saveStats(s);
      return true; // newly found
    }
    return false;
  }

  function statsSnapshot() {
    const s = getStats();
    return Object.assign({}, s, {
      totalLegendaryTexts: MBAnswers.ANSWERS.filter(a => a.rarity === 'legendary').length,
      totalThemes: MBThemes.THEMES.length
    });
  }

  // ===================== ACHIEVEMENTS =====================
  function evaluateAchievements() {
    const snap = statsSnapshot();
    const newlyUnlocked = [];
    MBAchievements.evaluate(snap, (def) => newlyUnlocked.push(def));
    if (!newlyUnlocked.length) return;
    // when several unlock in the same instant (e.g. the very first question
    // satisfies 5 "first steps" achievements at once), only the first gets the
    // full cinematic card — the rest are quick toasts so it doesn't feel like spam
    MBUI.showAchievementUnlock(newlyUnlocked[0]);
    MBProgression.addXP(20, () => {});
    newlyUnlocked.slice(1).forEach((def, i) => {
      setTimeout(() => {
        MBUI.showToast(`🏆 ${def.title}`);
        MBProgression.addXP(20, () => {});
      }, 260 * (i + 1));
    });
  }

  // ===================== XP / LEVEL / STREAK UI =====================
  function awardXpForAnswer(rarity) {
    const bonus = { common: 5, uncommon: 8, rare: 15, epic: 25, legendary: 45, mythic: 70, secret: 90 };
    MBProgression.addXP(bonus[rarity] || 5, (info) => MBUI.showLevelUp(info));
  }

  function updateStreakPill() {
    const s = getStats();
    if (s.sessionStreak >= 2) {
      streakPill.textContent = `🔥 ${s.sessionStreak} подряд`;
      streakPill.classList.remove('hidden');
    } else {
      streakPill.classList.add('hidden');
    }
  }

  // ===================== IDLE HINT =====================
  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (isRevealing) return;
      setHintLines('', 'Мне кажется, ты хочешь что-то спросить...');
    }, 24000);
  }
  ['pointerdown', 'keydown', 'input'].forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));

  function setHintLines(l1, l2) { hintLine1.textContent = l1; hintLine2.textContent = l2; }

  // ===================== PERSONALITY LINES =====================
  function maybeShowPersonalityLine() {
    const n = getStats().totalQuestions;
    const lines = { 5: 'Мы снова встретились.', 10: 'Ты опять здесь.', 50: 'Я начинаю тебя узнавать.', 100: 'Ты задаёшь слишком много вопросов.' };
    if (lines[n]) setTimeout(() => MBUI.showToast('🔮 ' + lines[n]), 2600);
  }

  // ===================== PERMISSION FLOW =====================
  function ensureMotionPermission(cb) {
    if (motionPermissionResolved || !MBShake.needsPermission()) { cb(true); return; }
    MBUI.showModal('permission-modal');
    const allowBtn = $('allow-motion-btn'), skipBtn = $('skip-motion-btn');
    const onAllow = async () => {
      const result = await MBShake.requestPermission();
      motionPermissionResolved = true;
      MBUI.hideModal('permission-modal'); cleanup();
      if (result === 'granted') { startMotionListening(); cb(true); }
      else { manualShakeBtn.classList.remove('hidden'); MBBall.setManualModeActive(true); cb(false); }
    };
    const onSkip = () => {
      motionPermissionResolved = true;
      MBUI.hideModal('permission-modal'); cleanup();
      manualShakeBtn.classList.remove('hidden'); MBBall.setManualModeActive(true);
      cb(false);
    };
    function cleanup() { allowBtn.removeEventListener('click', onAllow); skipBtn.removeEventListener('click', onSkip); }
    allowBtn.addEventListener('click', onAllow);
    skipBtn.addEventListener('click', onSkip);
  }

  // ===================== SHAKE ENGINE HOOKUP =====================
  function startMotionListening() {
    MBShake.start({ onTick: handleShakeTick, onRelease: handleShakeRelease, onOvercharge: handleOvercharge });
    MBBall.enableOrientationParallax();
  }

  let lastHintStage = null;
  let pendingStage = null;
  let pendingSince = 0;
  const HINT_DEBOUNCE_MS = 260; // ignore stage changes that don't hold for at least this long

  function handleShakeTick({ stage, intensity, energy }) {
    MBBall.setEnergyState({ intensity, energy });

    if (intensity > 0.08 && !chargeAudioActive) { chargeAudioActive = true; MBAudio.startCharge(); }
    if (intensity <= 0.05 && chargeAudioActive && energy < 0.05) { chargeAudioActive = false; MBAudio.stopCharge(); }
    if (chargeAudioActive) MBAudio.updateCharge(energy);

    const now = performance.now();
    if (now - lastShakeTickFx > 110) {
      lastShakeTickFx = now;
      if (intensity > 0.15) { MBHaptics.shakeTick(intensity); MBPhysics.kickShake(intensity * 0.5); }
      if (intensity > 0.2) MBAudio.playShakeTick(intensity);
      if (stage === 'strong' || stage === 'veryStrong') MBEffects.screenShake(180, intensity);
      if (stage === 'overcharge') MBEffects.screenShake(200, 1.6);
    }

    // Debounce the hint text specifically: the underlying stage can still
    // wobble near a band boundary, and re-writing the DOM text on every tick
    // reads as flashing/flickering to the user even if each value is valid.
    // Only commit a stage change once the SAME candidate has held steady
    // for a short stretch (the timer resets whenever the candidate changes).
    if (stage !== pendingStage) { pendingStage = stage; pendingSince = now; }
    if (stage === lastHintStage) return;              // already showing this, nothing to do
    if (now - pendingSince < HINT_DEBOUNCE_MS) return; // hasn't held steady long enough yet
    lastHintStage = stage;

    if (stage === 'idle') setHintLines('Задай вопрос в уме...', 'Потряси телефон 🔮');
    else if (stage === 'light') setHintLines('', 'Заряжаю шар...');
    else if (stage === 'medium') setHintLines('', 'Продолжай...');
    else if (stage === 'strong' || stage === 'veryStrong') setHintLines('', 'Почти готово...');
    else if (stage === 'overcharge') setHintLines('', '⚡ OVERCHARGE ⚡');
  }

  function handleOvercharge() {
    recordOvercharge();
    MBEffects.dimScreen(0.35, 200);
    MBHaptics.overcharge();
    MBAudio.playOvercharge();
    MBBall.triggerRings(4);
    MBUI.showToast('⚡ OVERCHARGE');
  }

  function handleShakeRelease(info) {
    awaitingShake = false;
    clearTimeout(motionWatchdog);
    chargeAudioActive = false;
    MBAudio.stopCharge();
    recordShake(info);
    if (info.perfect) {
      MBUI.showToast('🎯 PERFECT SHAKE');
      MBHaptics.success();
    }
    runCinematicReveal(info.level, info);
  }

  // ===================== ANSWER SELECTION (with game-mode bias) =====================
  function pickAnswer(questionText) {
    const s = getStats();
    let a = MBAnswers.getRandomAnswer(s.recentTexts, questionText);

    if (settings.gameMode === 'chaos') {
      // roll twice, keep whichever is rarer — makes chaos mode noticeably wilder
      const b = MBAnswers.getRandomAnswer(s.recentTexts, questionText);
      if (MBAnswers.rarityIndex(b.rarity) > MBAnswers.rarityIndex(a.rarity)) a = b;
    } else if (settings.gameMode === 'mystic' && Math.random() < 0.6) {
      const mysticPool = MBAnswers.ANSWERS.filter(x => x.category === 'mystic' && x.rarity === a.rarity);
      if (mysticPool.length) a = mysticPool[Math.floor(Math.random() * mysticPool.length)];
    }
    return a;
  }

  // ===================== CINEMATIC REVEAL TIMELINE =====================
  function runCinematicReveal(level, flags) {
    if (isRevealing) return;
    isRevealing = true;
    resultActions.classList.add('hidden');
    rarityLabel.classList.add('hidden');
    unlockAudioOnce();
    MBAudio.startAmbient();

    const answerObj = pickAnswer(questionInput.value.trim());
    const useFast = settings.fastMode;
    const useCinematic = settings.cinematic && !useFast;

    if (useFast) {
      // shake -> reveal, no dramatic pauses
      MBAudio.playWhoosh();
      MBPhysics.kickShake(0.8);
      MBBall.collapseVortex(220);
      setTimeout(() => finishReveal(answerObj, level, flags), 260);
      return;
    }

    // ---- full cinematic timeline (compressed to feel snappy on mobile) ----
    MBAudio.playWhoosh();
    setHintLines('', '');
    ballText.style.opacity = '0';

    const t = (ms, fn) => setTimeout(fn, ms);

    t(0,   () => { MBPhysics.kickShake(0.6); });                                  // freeze/jolt
    t(180, () => { if (useCinematic) MBEffects.dimScreen(0.25, 250); });          // silence beat
    t(380, () => { if (useCinematic) MBEffects.dimScreen(0.4, 300); MBEffects.cameraZoom(1.025, 900); }); // dim + slow zoom
    t(650, () => { MBBall.setEnergyState({ energy: 1 }); MBAudio.playSpin(); });  // vortex accelerates
    t(950, () => { MBBall.collapseVortex(380); });                                // core compresses
    t(1280,() => {
      MBEffects.flashBall(rarityStrength(answerObj.rarity));
      if (['legendary', 'mythic', 'secret'].includes(answerObj.rarity)) MBEffects.legendaryScreenFlash();
    });
    t(1380,() => { MBEffects.spawnShockwave(answerObj.rarity === 'mythic' ? 3 : 1); MBEffects.screenShake(300, 1.4); MBPhysics.kickShake(0.9); });
    t(1550,() => finishReveal(answerObj, level, flags));
    t(1950,() => { if (useCinematic) MBEffects.undimScreen(500); });
  }

  function rarityStrength(rarity) {
    return { common: 0.5, uncommon: 0.6, rare: 0.8, epic: 1, legendary: 1.3, mythic: 1.6, secret: 1 }[rarity] || 0.5;
  }

  function finishReveal(answerObj, level, flags) {
    MBHaptics.reveal(answerObj.rarity);
    MBAudio.playReveal(answerObj.rarity);
    MBBall.burstCore(answerObj.rarity === 'mythic' ? 300 : 180);
    MBBall.triggerRings(answerObj.rarity === 'legendary' || answerObj.rarity === 'mythic' ? 4 : 1);

    if (answerObj.rarity === 'mythic') {
      MBBall.setStarSpeed(3.2);
      setTimeout(() => MBBall.setStarSpeed(1), 2600);
    }

    const revealText = () => {
      ballText.style.opacity = '0';
      setTimeout(() => {
        ballText.textContent = answerObj.text;
        ballText.classList.toggle('legendary-text', ['legendary', 'mythic', 'secret'].includes(answerObj.rarity));
        ballText.style.opacity = '1';
        if (answerObj.rarity !== 'common') {
          rarityLabel.textContent = answerObj.rarity.toUpperCase();
          rarityLabel.classList.remove('hidden');
        }
      }, 120);
    };

    if (answerObj.rarity === 'secret') {
      MBEffects.secretGlitch(() => {}, 420);
      setTimeout(revealText, 220);
    } else {
      revealText();
    }

    const stats = recordAnswer(answerObj, MBShake.getIntensity());
    MBHistory.add({
      question: questionInput.value.trim(), answer: answerObj.text,
      category: answerObj.category, rarity: answerObj.rarity,
      theme: MBThemes.getCurrentTheme(), shakeIntensity: level
    });
    MBProgression.registerInteraction();
    awardXpForAnswer(answerObj.rarity);
    evaluateAchievements();
    updateStreakPill();
    maybeShowPersonalityLine();

    setHintLines('Задай новый вопрос в уме...', 'Потряси телефон ещё раз 🔮');
    resultActions.classList.remove('hidden');
    resultActions.dataset.answer = answerObj.text;
    resultActions.dataset.rarity = answerObj.rarity;

    isRevealing = false;
  }

  function unlockAudioOnce() { if (audioUnlockedOnce) return; audioUnlockedOnce = true; MBAudio.unlock(); }

  // ===================== TRIGGERS =====================
  function isMobileLike() { return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0; }

  let motionWatchdog = null;
  let awaitingShake = false;
  function armMotionWatchdog() {
    awaitingShake = true;
    clearTimeout(motionWatchdog);
    // stage 1 (7s): reveal the manual fallback button
    motionWatchdog = setTimeout(() => {
      manualShakeBtn.classList.remove('hidden');
      MBBall.setManualModeActive(true);
      setHintLines('Не получается почувствовать тряску?', 'Нажми «Спросить» ещё раз, чтобы получить ответ');
      // stage 2 (+6s more): guarantee an answer no matter what the sensors are doing —
      // a user should never be permanently stuck waiting for a shake that never registers
      motionWatchdog = setTimeout(() => {
        if (awaitingShake && !MBShake.isLocked()) MBShake.forceRelease('medium');
      }, 6000);
    }, 7000);
  }

  function attemptAsk() {
    unlockAudioOnce();
    // if we're already waiting on a real shake and the user taps the button
    // again, treat it as "just give me the answer" instead of making them wait
    if (awaitingShake && !MBShake.isLocked()) {
      clearTimeout(motionWatchdog);
      awaitingShake = false;
      MBShake.forceRelease('medium');
      return;
    }
    if (isMobileLike() && MBShake.isSupported()) {
      ensureMotionPermission((granted) => {
        setHintLines('Задай вопрос в уме...', granted ? 'Теперь потряси телефон 🔮' : 'Нажми «Зарядить шар пальцем»');
        if (granted) { startMotionListening(); armMotionWatchdog(); }
      });
    } else {
      MBShake.forceRelease('medium');
    }
  }

  askBtn.addEventListener('click', attemptAsk);
  manualShakeBtn.addEventListener('click', () => {
    unlockAudioOnce();
    MBBall.setManualModeActive(true);
    MBUI.showToast('Проведи пальцем по шару быстрее ✨');
  });

  questionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); attemptAsk(); } });
  document.addEventListener('keydown', (e) => {
    if (e.target === questionInput) return;
    if (e.code === 'Space') { e.preventDefault(); attemptAsk(); }
  });

  // ===================== TOUCH GESTURES ON BALL (taps / long press / secret words) =====================
  const bump7 = MBUI.createClickCounter(7, () => {
    if (recordEasterEgg('tap7')) { evaluateAchievements(); }
    MBUI.showToast('✨ Что-то шевельнулось внутри шара...');
    MBBall.triggerRings(2);
    MBAudio.playAlert();
  });
  const bump13 = MBUI.createClickCounter(13, () => {
    if (recordEasterEgg('tap13')) { evaluateAchievements(); }
    MBEffects.chromaticPulse(600);
    MBUI.showToast('🕷️ ...');
  }, 4000);

  let tapTimes = [];
  let pressTimer = null, pressStart = 0;
  ballWrap.addEventListener('pointerdown', () => {
    pressStart = Date.now();
    pressTimer = setTimeout(() => {
      if (recordEasterEgg('longpress')) evaluateAchievements();
      MBBall.setEnergyState({ energy: 0.6 });
      MBHaptics.medium();
      MBUI.showToast('🕯️ Энергия накапливается...');
    }, 900);
  });
  ballWrap.addEventListener('pointerup', () => {
    clearTimeout(pressTimer);
    const now = Date.now();
    tapTimes.push(now);
    tapTimes = tapTimes.filter(t => now - t < 500);
    if (tapTimes.length === 3) { MBEffects.flashBall(0.6); MBBall.triggerRings(1); }
    bump7(); bump13();
    MBAudio.playClick();
  });
  ballWrap.addEventListener('pointercancel', () => clearTimeout(pressTimer));

  questionInput.addEventListener('input', () => {
    const q = questionInput.value.toLowerCase();
    if (q.includes('шар, ты меня слышишь') || q.includes('ты живой')) {
      if (recordEasterEgg('secretword')) evaluateAchievements();
    }
  });

  // ===================== RESULT ACTIONS ===================
  $('share-btn').addEventListener('click', async () => {
    const answer = resultActions.dataset.answer;
    const result = await MBShare.shareAnswer(answer);
    if (result === 'copied') MBUI.showToast('Скопировано в буфер обмена 📋');
  });
  $('copy-btn').addEventListener('click', async () => {
    await MBShare.copyToClipboard(MBShare.buildShareText(resultActions.dataset.answer));
    MBUI.showToast('Скопировано 📋');
  });
  $('card-btn').addEventListener('click', () => {
    const canvas = $('card-canvas');
    const style = getComputedStyle(document.body);
    MBShare.renderCard(canvas, {
      question: questionInput.value.trim(), answer: resultActions.dataset.answer, rarity: resultActions.dataset.rarity,
      themeColors: { a: style.getPropertyValue('--glow-a').trim(), b: style.getPropertyValue('--glow-b').trim() }
    });
    MBUI.showModal('card-modal');
  });
  $('card-close-btn').addEventListener('click', () => MBUI.hideModal('card-modal'));
  $('card-download-btn').addEventListener('click', () => MBShare.downloadCanvas($('card-canvas'), 'magic-ball-answer.png'));

  // ===================== SHEETS / NAV =====================
  MBUI.wireCloseButtons();
  $('settings-btn').addEventListener('click', () => MBUI.openSheet('settings-sheet'));
  $('history-btn').addEventListener('click', () => { renderHistory('all'); MBUI.openSheet('history-sheet'); });
  $('stats-btn').addEventListener('click', () => { renderStats(); MBUI.openSheet('stats-sheet'); });
  $('achievements-btn').addEventListener('click', () => { renderAchievements('all'); MBUI.openSheet('achievements-sheet'); });
  $('daily-btn').addEventListener('click', () => openDailyProphecy());

  $('open-history').addEventListener('click', () => { renderHistory('all'); MBUI.openSheet('history-sheet'); });
  $('open-achievements').addEventListener('click', () => { renderAchievements('all'); MBUI.openSheet('achievements-sheet'); });
  $('open-stats').addEventListener('click', () => { renderStats(); MBUI.openSheet('stats-sheet'); });
  $('open-daily').addEventListener('click', () => openDailyProphecy());

  $('clear-history-btn').addEventListener('click', () => { MBHistory.clear(); renderHistory('all'); MBUI.showToast('История очищена'); });

  document.querySelectorAll('#history-filters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#history-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderHistory(chip.dataset.filter);
    });
  });

  function renderHistory(filter) { MBHistory.render($('history-list'), filter); }
  function renderAchievements(cat) { MBAchievements.render($('achievements-list'), statsSnapshot(), cat); }
  MBAchievements.renderFilters($('achievement-filters'), (cat) => renderAchievements(cat));

  function renderStats() {
    const s = getStats();
    const xp = MBProgression.getXpProgress();
    const conn = MBProgression.getConnection();

    $('level-card').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <strong style="font-size:16px;">Уровень ${xp.level} · ${xp.title}</strong>
        <span style="font-size:11px;color:var(--text-dim)">${xp.xp} XP</span>
      </div>
      <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${Math.round(xp.pct * 100)}%"></div></div>
    `;

    const grid = $('stats-grid');
    const rarest = ['secret', 'mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'].find(r => s.rarityCounts[r] > 0) || '—';
    grid.innerHTML = `
      <div class="stat-card wide"><div class="stat-num">${s.totalQuestions}</div><div class="stat-label">Всего вопросов</div></div>
      <div class="stat-card"><div class="stat-num">${s.categoryCounts.positive}</div><div class="stat-label">Положительных</div></div>
      <div class="stat-card"><div class="stat-num">${s.categoryCounts.negative}</div><div class="stat-label">Отрицательных</div></div>
      <div class="stat-card"><div class="stat-num">${s.maxStreak}</div><div class="stat-label">Лучшая серия</div></div>
      <div class="stat-card"><div class="stat-num">${(s.rarityCounts.rare||0)+(s.rarityCounts.epic||0)+(s.rarityCounts.legendary||0)+(s.rarityCounts.mythic||0)}</div><div class="stat-label">Редких ответов</div></div>
      <div class="stat-card"><div class="stat-num">${s.rarityCounts.legendary||0}</div><div class="stat-label">Legendary найдено</div></div>
      <div class="stat-card"><div class="stat-num">${s.rarityCounts.secret||0}</div><div class="stat-label">Secret найдено</div></div>
      <div class="stat-card"><div class="stat-num">${MBAchievements.unlockedCount()}/${MBAchievements.totalCount()}</div><div class="stat-label">Достижения</div></div>
      <div class="stat-card wide"><div class="stat-num">${rarest.toUpperCase()}</div><div class="stat-label">Самый редкий найденный ответ</div></div>
      <div class="stat-card wide"><div class="stat-num">${s.daysUsed.length}</div><div class="stat-label">Дней использования</div></div>
    `;

    $('connection-card').innerHTML = `
      <strong>Связь с шаром: ${conn.label}</strong>
      <div style="font-size:11.5px;color:var(--text-dim);margin-top:4px;">${conn.interactions} взаимодействий${conn.nextTier ? ` · до «${conn.nextTier.label}»: ${conn.nextTier.min - conn.interactions}` : ''}</div>
    `;
    $('collection-card').innerHTML = `
      <strong>Коллекция</strong>
      <div style="font-size:12.5px;color:var(--text-1);margin-top:6px;">Rare открыто: ${s.uniqueRare.length} / ${MBAnswers.ANSWERS.filter(a=>a.rarity==='rare').length}</div>
      <div style="font-size:12.5px;color:var(--text-1);">Epic открыто: ${s.uniqueEpic.length} / ${MBAnswers.ANSWERS.filter(a=>a.rarity==='epic').length}</div>
      <div style="font-size:12.5px;color:var(--text-1);">Legendary открыто: ${s.uniqueLegendary.length} / ${MBAnswers.ANSWERS.filter(a=>a.rarity==='legendary').length}</div>
      <div style="font-size:12.5px;color:var(--text-1);">Тем опробовано: ${s.themesApplied.length} / ${MBThemes.THEMES.length}</div>
      <div style="font-size:12.5px;color:var(--text-1);">Easter Eggs: ${s.easterEggs.length}</div>
    `;
  }

  // ===================== DAILY PROPHECY =====================
  function openDailyProphecy() {
    const status = MBProgression.getDailyStatus();
    const content = $('daily-content');
    if (status.claimed) {
      content.innerHTML = `
        <div class="daily-answer">«${status.answer}»</div>
        <div class="daily-luck">Удача дня: ${status.luck}%</div>
      `;
    } else {
      content.innerHTML = `<button id="daily-reveal-btn" class="primary-btn">Открыть пророчество дня</button>`;
      $('daily-reveal-btn').addEventListener('click', () => {
        unlockAudioOnce();
        const answerObj = pickAnswer('');
        MBAudio.playWhoosh();
        MBHaptics.medium();
        const claimed = MBProgression.claimDailyProphecy(answerObj);
        MBProgression.addXP(15, (info) => MBUI.showLevelUp(info));
        content.innerHTML = `
          <div class="daily-answer">«${claimed.answer}»</div>
          <div class="daily-luck">Удача дня: ${claimed.luck}%</div>
        `;
      }, { once: true });
    }
    MBUI.showModal('daily-modal');
  }

  // ===================== SETTINGS WIRING =====================
  MBUI.wireSettingsToggles({
    onSoundChange: (v) => { MBAudio.setEnabled(v); if (v) MBAudio.startAmbient(); else MBAudio.stopAmbient(); },
    onVibrationChange: (v) => MBHaptics.setEnabled(v),
    onEffectsChange: () => {},
    onAnimationsChange: (v) => MBBall.setAnimationsEnabled(v),
    onModeChange: (mode) => { MBThemes.applyDayNight(mode); MBBall.reseedStars(); },
    onQualityChange: () => { MBBall.reseedStars(); },
    onCinematicChange: (v) => { settings.cinematic = v; },
    onFastModeChange: (v) => { settings.fastMode = v; },
    onGameModeChange: (v) => { settings.gameMode = v; }
  });

  // theme grid with preview-before-commit
  MBThemes.renderThemePicker($('theme-grid'), $('theme-preview-bar'));
  $('theme-apply-btn').addEventListener('click', () => {
    MBThemes.commitPreview();
    recordThemeApplied(MBThemes.getCurrentTheme());
    evaluateAchievements();
    $('theme-preview-bar').classList.add('hidden');
    MBUI.showToast('Тема применена');
  });
  // if the settings sheet closes without confirming, revert the preview
  // (and re-sync the swatch grid's active highlight, which otherwise stays stuck)
  function revertThemePreview() {
    MBThemes.cancelPreview();
    $('theme-preview-bar').classList.add('hidden');
    MBThemes.renderThemePicker($('theme-grid'), $('theme-preview-bar'));
  }
  document.querySelectorAll('[data-close="settings-sheet"]').forEach(btn => {
    btn.addEventListener('click', revertThemePreview);
  });
  $('sheet-backdrop').addEventListener('click', revertThemePreview);

  // ===================== DEBUG PANEL (5 taps on version tag) =====================
  let debugOn = false;
  const bumpDebug = MBUI.createClickCounter(5, () => {
    debugOn = !debugOn;
    $('debug-panel').classList.toggle('hidden', !debugOn);
  }, 1500);
  $('version-tag').addEventListener('click', bumpDebug);

  function debugLoop() {
    if (debugOn) {
      const xp = MBProgression.getXpProgress();
      $('debug-panel').textContent =
        `FPS: ${MBQuality.getFps()}\n` +
        `quality: ${MBQuality.effectiveTier()}\n` +
        `shake energy: ${MBShake.getEnergy().toFixed(2)}\n` +
        `shake intensity: ${MBShake.getIntensity().toFixed(2)}\n` +
        `xp: ${xp.xp} (lvl ${xp.level})\n` +
        `sensor: ${MBShake.isSupported() ? 'yes' : 'no'}`;
    }
    requestAnimationFrame(debugLoop);
  }
  requestAnimationFrame(debugLoop);

  // ===================== INIT =====================
  // Order matters here: the core ask -> shake -> answer pipeline is registered
  // FIRST and unconditionally, before anything decorative (canvas rendering,
  // theming, orientation, etc). If a decorative subsystem throws on some
  // unusual browser, it must not be able to prevent MBShake's handlers from
  // being registered — otherwise the "Спросить" button would look clickable
  // but silently do nothing, which is much harder to diagnose than a visual
  // glitch. Each optional piece is wrapped so one failure can't cascade.
  function safely(label, fn) {
    try { fn(); } catch (e) { console.error('[MagicBall] Ошибка при инициализации «' + label + '»:', e); }
  }

  function init() {
    // 1) CRITICAL: always register shake/ask handlers first, no matter what.
    MBShake.start({ onTick: handleShakeTick, onRelease: handleShakeRelease, onOvercharge: handleOvercharge });
    resetIdleTimer();

    if (isMobileLike() && MBShake.isSupported() && !MBShake.needsPermission()) {
      armMotionWatchdog();
      setHintLines('Задай вопрос в уме...', 'Теперь потряси телефон 🔮');
    } else if (isMobileLike() && MBShake.isSupported()) {
      setHintLines('Задай вопрос в уме...', 'Нажми «Спросить», чтобы разрешить магию');
    } else {
      setHintLines('Задай вопрос в уме...', 'Нажми «Спросить», чтобы получить предсказание');
    }

    // 2) Decorative/visual subsystems — each isolated so a failure in one
    // (e.g. canvas quirks on an unusual browser) can't break the others
    // or, critically, the core interaction registered above.
    safely('темы', () => {
      MBThemes.applyTheme(MBThemes.getCurrentTheme());
      MBThemes.applyDayNight(MBStorage.get('mb_daymode', 'auto'));
    });
    safely('шар/канвас', () => MBBall.init());
    safely('гироскоп', () => {
      if (isMobileLike() && MBShake.isSupported() && !MBShake.needsPermission()) {
        MBBall.enableOrientationParallax();
      }
    });

    // 3) Offline support — never allowed to affect anything above.
    safely('service worker', () => {
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
      }
    });
  }

  init();
})();
