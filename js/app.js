/* app.js — v2.0 orchestration: cinematic stages tied to shake-intensity engine,
   rarity system, magic energy/combo, daily prophecy, secrets, contextual answers. */
(function () {
  const $ = (id) => document.getElementById(id);

  const ballWrap = $('ball-wrap');
  const ballGlass = $('ball-glass');
  const ballText = $('ball-text');
  const questionInput = $('question-input');
  const askBtn = $('ask-btn');
  const manualShakeBtn = $('manual-shake-btn');
  const hintLine1 = $('hint-line-1');
  const hintLine2 = $('hint-line-2');
  const resultActions = $('result-actions');
  const energyFill = $('energy-fill');
  const comboBadge = $('combo-badge');

  let isRevealing = false;
  let recentAnswerTexts = []; // last few answer texts, most recent first
  let motionPermissionResolved = false;
  let idleTimer = null;
  let audioUnlockedOnce = false;
  let usageCount = MBStorage.get('mb_usage_count', 0);
  let lastCategory = null;
  let sameCategoryStreak = 0;

  // ===================== STATS =====================
  const STATS_KEY = 'mb_stats';
  function defaultStats() {
    return {
      totalQuestions: 0,
      categoryCounts: {},
      rarityCounts: {},
      daysUsed: [],
      questionsPerDay: {},
      sessionStreak: 0,
      maxStreak: 0,
      answerFrequency: {},
      comboBest: 0,
      perfectShakes: 0,
      overcharges: 0,
      calmShakes: 0,
      extremeShakes: 0,
      sameCategoryStreak: 0,
      hadNightPrediction: false,
      themeSwitched: false,
      claimedDaily: false,
      pwaFirstPrediction: false
    };
  }
  function getStats() { return { ...defaultStats(), ...MBStorage.get(STATS_KEY, {}) }; }
  function saveStats(s) { MBStorage.set(STATS_KEY, s); }

  function isStandalonePWA() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }

  function recordAnswer(answerObj, special) {
    const s = getStats();
    s.totalQuestions++;
    s.categoryCounts[answerObj.category] = (s.categoryCounts[answerObj.category] || 0) + 1;
    s.rarityCounts[answerObj.rarity] = (s.rarityCounts[answerObj.rarity] || 0) + 1;

    const today = new Date().toISOString().slice(0, 10);
    if (!s.daysUsed.includes(today)) s.daysUsed.push(today);
    s.questionsPerDay[today] = (s.questionsPerDay[today] || 0) + 1;
    s.maxQuestionsInDay = Math.max(s.maxQuestionsInDay || 0, s.questionsPerDay[today]);

    s.sessionStreak++;
    s.maxStreak = Math.max(s.maxStreak, s.sessionStreak);
    s.answerFrequency[answerObj.text] = (s.answerFrequency[answerObj.text] || 0) + 1;

    if (answerObj.category === lastCategory) sameCategoryStreak++; else sameCategoryStreak = 1;
    lastCategory = answerObj.category;
    s.sameCategoryStreak = Math.max(s.sameCategoryStreak || 0, sameCategoryStreak);

    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) s.hadNightPrediction = true;

    if (special === 'perfect') s.perfectShakes = (s.perfectShakes || 0) + 1;
    if (special === 'overcharge') s.overcharges = (s.overcharges || 0) + 1;
    if (special === 'calm') s.calmShakes = (s.calmShakes || 0) + 1;

    if (MBStorage.get('mb_theme_switched_flag', false)) s.themeSwitched = true;
    if (isStandalonePWA()) s.pwaFirstPrediction = true;

    saveStats(s);
    return s;
  }

  function repeatedAnswerHits(stats) {
    return Object.values(stats.answerFrequency).reduce((sum, c) => sum + Math.max(0, c - 1), 0);
  }

  function renderStats() {
    const s = getStats();
    const combo = MBEnergy.getCombo();
    const grid = $('stats-grid');
    const rarest = ['secret', 'mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']
      .find(r => (s.rarityCounts[r] || 0) > 0) || '—';
    const rarestLabel = { secret: 'Secret', mythic: 'Mythic', legendary: 'Legendary', epic: 'Epic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common', '—': '—' }[rarest];
    const yes = s.categoryCounts.yes || 0, no = s.categoryCounts.no || 0, maybe = s.categoryCounts.maybe || 0;
    const rareTotal = ['uncommon','rare','epic','legendary','mythic','secret'].reduce((a, r) => a + (s.rarityCounts[r] || 0), 0);
    const favCategory = Object.entries(s.categoryCounts).sort((a, b) => b[1] - a[1])[0];
    grid.innerHTML = `
      <div class="stat-card wide"><div class="stat-num">${s.totalQuestions}</div><div class="stat-label">Всего предсказаний</div></div>
      <div class="stat-card"><div class="stat-num">${yes}</div><div class="stat-label">Да</div></div>
      <div class="stat-card"><div class="stat-num">${no}</div><div class="stat-label">Нет</div></div>
      <div class="stat-card"><div class="stat-num">${maybe}</div><div class="stat-label">Может быть</div></div>
      <div class="stat-card"><div class="stat-num">${rareTotal}</div><div class="stat-label">Редких ответов</div></div>
      <div class="stat-card"><div class="stat-num">${s.rarityCounts.legendary || 0}</div><div class="stat-label">Legendary</div></div>
      <div class="stat-card"><div class="stat-num">${s.rarityCounts.mythic || 0}</div><div class="stat-label">Mythic</div></div>
      <div class="stat-card"><div class="stat-num">${combo.count}</div><div class="stat-label">Текущая серия</div></div>
      <div class="stat-card"><div class="stat-num">${combo.best}</div><div class="stat-label">Лучшая серия</div></div>
      <div class="stat-card wide"><div class="stat-num">${rarestLabel}</div><div class="stat-label">Самый редкий найденный ответ</div></div>
      <div class="stat-card wide"><div class="stat-num">${favCategory ? favCategory[0] : '—'}</div><div class="stat-label">Любимая тема вопросов</div></div>
      <div class="stat-card wide"><div class="stat-num">${s.daysUsed.length}</div><div class="stat-label">Дней использования</div></div>
    `;
  }

  // ===================== ACHIEVEMENTS =====================
  function evaluateAchievements() {
    const s = getStats();
    const combo = MBEnergy.getCombo();
    const snapshot = { ...s, comboBest: combo.best };
    MBAchievements.evaluate(snapshot, (def) => {
      MBUI.showToast(`🏆 Достижение: «${def.title}»`);
      if (global.MBAudio) MBAudio.playPerfectShake();
    });
  }

  // ===================== ENERGY / COMBO UI =====================
  function renderEnergy() {
    if (!energyFill) return;
    const v = MBEnergy.getEnergy();
    energyFill.style.width = v + '%';
    const wrap = $('energy-bar');
    if (wrap) wrap.dataset.tier = MBEnergy.energyTier(v);
  }

  // ===================== IDLE HINT / RANDOM EVENTS =====================
  function resetIdleTimer() {
    clearTimeout(idleTimer);
    ballWrap.classList.remove('idle-pulse');
    idleTimer = setTimeout(() => {
      if (isRevealing) return;
      ballWrap.classList.add('idle-pulse');
      MBBall.spawnInternalSpark();
      setHintLines('', 'Мне кажется, ты хочешь что-то спросить...');
    }, 24000);
  }
  ['pointerdown', 'keydown', 'input'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  function idleLoop() {
    if (!isRevealing) {
      MBEffects.maybeRandomIdleEvent(0.0015);
    }
    requestAnimationFrame(idleLoop);
  }

  function setHintLines(l1, l2) {
    hintLine1.textContent = l1;
    hintLine2.textContent = l2;
  }

  // ===================== PERMISSION FLOW =====================
  function ensureMotionPermission(cb) {
    if (motionPermissionResolved || !MBShake.needsPermission()) { cb(true); return; }
    MBUI.showModal('permission-modal');
    const allowBtn = $('allow-motion-btn');
    const skipBtn = $('skip-motion-btn');
    const onAllow = async () => {
      const result = await MBShake.requestPermission();
      motionPermissionResolved = true;
      MBUI.hideModal('permission-modal');
      cleanup();
      if (result === 'granted') { startMotionListening(); cb(true); }
      else { manualShakeBtn.classList.remove('hidden'); cb(false); }
    };
    const onSkip = () => {
      motionPermissionResolved = true;
      MBUI.hideModal('permission-modal');
      cleanup();
      manualShakeBtn.classList.remove('hidden');
      cb(false);
    };
    function cleanup() { allowBtn.removeEventListener('click', onAllow); skipBtn.removeEventListener('click', onSkip); }
    allowBtn.addEventListener('click', onAllow);
    skipBtn.addEventListener('click', onSkip);
  }

  // ===================== MOTION LISTENING (drives shake stages live) =====================
  function startMotionListening() {
    MBShake.start(
      (stage, intensityPct) => { onShakeStage(stage, intensityPct); },
      (result) => { clearTimeout(motionWatchdog); runRevealSequence(result); }
    );
    MBBall.enableOrientationParallax();
  }

  function onShakeStage(stage, pct) {
    if (isRevealing) return;
    ballWrap.classList.remove('stage-0', 'stage-1', 'stage-2', 'stage-3', 'stage-4');
    ballWrap.classList.add('stage-' + stage);
    MBBall.setChargeLevel(pct);
    if (stage >= 1) MBEnergy.chargeEnergy(0.6);
    if (stage >= 2 && Math.random() < 0.15) MBAudio.playCharge(pct);
    if (stage >= 2) MBVibration.shakeTick(stage);
    if (stage >= 3 && Math.random() < 0.12) MBEffects.spawnLightning(ballGlass);
    if (stage === 2) MBEffects.screenShake(160);
    if (stage === 3) { MBEffects.screenShake(220); MBBall.spawnEnergyRing(); }
    if (stage === 4) { MBEffects.screenShake(260); if (Math.random() < 0.4) MBBall.spawnEnergyRing(); }
    renderEnergy();
  }

  // ===================== CINEMATIC REVEAL SEQUENCE =====================
  function skipCinematic() {
    return usageCount >= 3 && MBStorage.get('mb_cinematic_mode', 'full') === 'auto_skip_after_uses';
  }

  function runRevealSequence(shakeResult) {
    if (isRevealing) return;
    isRevealing = true;
    resetIdleTimer();
    resultActions.classList.add('hidden');
    ballWrap.classList.remove('idle-pulse', 'stage-0', 'stage-1', 'stage-2', 'stage-3', 'stage-4');
    MBBall.setChargeLevel(0);

    unlockAudioOnce();
    MBAudio.startAmbient();
    MBAudio.playWhoosh();
    MBAudio.playSpin();

    const level = shakeResult.level; // weak|medium|strong|extreme
    const special = shakeResult.special; // perfect|overcharge|calm|null
    ballWrap.classList.add('shaking', 'shake-' + level);

    if (level === 'strong' || level === 'extreme') MBEffects.screenShake(level === 'extreme' ? 950 : 650);
    MBBall.burstParticles(level === 'extreme' ? 55 : level === 'strong' ? 35 : level === 'medium' ? 20 : 8, '--glow-a', level === 'extreme' ? 1.9 : 1.1);
    MBVibration.shakeTick(level === 'extreme' ? 4 : level === 'strong' ? 3 : level === 'medium' ? 2 : 1);
    if (special === 'perfect') { MBVibration.perfectShake(); MBAudio.playPerfectShake(); }
    if (special === 'overcharge') { MBVibration.overcharge(); }
    if (special === 'calm') MBVibration.calmShake();

    setHintLines('', '');
    ballText.textContent = '';

    const useSkip = skipCinematic();
    const shakeDuration = useSkip ? 250 : (level === 'extreme' ? 1500 : level === 'strong' ? 1200 : level === 'medium' ? 950 : 700);

    if (!useSkip) {
      let tickCount = 0;
      const maxTicks = Math.round(shakeDuration / 170);
      const tickInterval = setInterval(() => {
        tickCount++;
        MBAudio.playShakeTick(level === 'extreme' ? 2 : level === 'strong' ? 1.7 : 1);
        if (tickCount >= maxTicks) clearInterval(tickInterval);
      }, 170);
    }

    // Stage 4 -> silence -> pause -> flash (spec section 6)
    setTimeout(() => {
      ballWrap.classList.remove('shaking', 'shake-weak', 'shake-medium', 'shake-strong', 'shake-extreme');
      const pause = useSkip ? 80 : (220 + Math.random() * 320);
      setTimeout(() => runStageTexts(0, shakeResult, useSkip), pause);
    }, shakeDuration);
  }

  const STAGE_TEXTS = ['Сканирование судьбы...', 'Анализ вероятностей...', 'Ответ найден.'];

  function runStageTexts(index, shakeResult, useSkip) {
    if (index >= STAGE_TEXTS.length) { revealAnswer(shakeResult); return; }
    if (useSkip) { revealAnswer(shakeResult); return; }
    ballText.classList.remove('legendary-text', 'mythic-text');
    ballText.style.opacity = '0';
    setTimeout(() => { ballText.textContent = STAGE_TEXTS[index]; ballText.style.opacity = '.85'; }, 110);
    setTimeout(() => runStageTexts(index + 1, shakeResult, useSkip), 560);
  }

  function resolveAnswerForShake(shakeResult) {
    const question = questionInput.value.trim();
    if (shakeResult.special === 'perfect') return MBAnswers.perfectShakeAnswer();
    if (shakeResult.special === 'overcharge') return MBAnswers.overchargeAnswer();
    if (shakeResult.special === 'calm') return MBAnswers.calmShakeAnswer();
    const luckBoost = MBEnergy.computeLuck();
    return MBAnswers.getRandomAnswer({ question, recentTexts: recentAnswerTexts, luckBoost });
  }

  function revealAnswer(shakeResult) {
    const answerObj = resolveAnswerForShake(shakeResult);
    recentAnswerTexts.unshift(answerObj.text);
    if (recentAnswerTexts.length > 6) recentAnswerTexts.length = 6;

    MBEffects.flashBall();
    MBEffects.spawnShockwave();
    MBAudio.playReveal(answerObj.rarity);
    MBVibration.reveal(answerObj.rarity);

    const meta = MBAnswers.RARITY_META[answerObj.rarity] || {};
    if (meta.particles) MBBall.burstParticles(meta.particles, meta.color, 1 + (meta.particles / 60));

    if (answerObj.rarity === 'legendary') { MBEffects.legendaryScreenFlash(); pulseBallGlassColor(); }
    if (answerObj.rarity === 'mythic') { MBEffects.mythicScreenTakeover(1500); pulseBallGlassColor(true); }
    if (answerObj.rarity === 'secret') { glitchReveal(); }

    ballText.style.opacity = '0';
    setTimeout(() => {
      ballText.textContent = answerObj.text;
      ballText.classList.toggle('legendary-text', answerObj.rarity === 'legendary' || answerObj.rarity === 'secret');
      ballText.classList.toggle('mythic-text', answerObj.rarity === 'mythic');
      ballText.style.opacity = '1';
    }, 140);

    const stats = recordAnswer(answerObj, shakeResult.special);
    MBHistory.add({ question: questionInput.value.trim(), answer: answerObj.text, category: answerObj.category, rarity: answerObj.rarity });

    // energy / combo / progression
    MBBall.setChargeLevel(0);
    MBEnergy.chargeEnergy(answerObj.rarity === 'common' ? 4 : 10);
    MBEnergy.stabilizeEnergy();
    renderEnergy();
    const combo = MBEnergy.bumpCombo();
    const comboMsg = MBEnergy.comboMessage(combo.count);
    if (comboMsg) MBUI.showToast('🔗 ' + comboMsg);
    if (comboBadge) { comboBadge.textContent = combo.count > 1 ? `x${combo.count}` : ''; comboBadge.classList.toggle('hidden', combo.count <= 1); }

    usageCount++;
    MBStorage.set('mb_usage_count', usageCount);
    const milestoneMsg = MBEnergy.milestoneMessage(stats.totalQuestions);

    evaluateAchievements();

    setHintLines('Задай новый вопрос в уме...', milestoneMsg || 'Потряси телефон ещё раз 🔮');

    resultActions.classList.remove('hidden');
    resultActions.dataset.answer = answerObj.text;
    resultActions.dataset.rarity = answerObj.rarity;

    if (usageCount === 1) {
      MBUI.showToast('✨ Первое предсказание завершено.');
    }

    isRevealing = false;
  }

  function pulseBallGlassColor(strong) {
    ballGlass.style.filter = strong ? 'brightness(1.7) saturate(1.5)' : 'brightness(1.25) saturate(1.2)';
    setTimeout(() => { ballGlass.style.filter = ''; }, strong ? 1500 : 900);
  }

  function glitchReveal() {
    MBEffects.glitchEvent();
  }

  function unlockAudioOnce() {
    if (audioUnlockedOnce) return;
    audioUnlockedOnce = true;
    MBAudio.unlock();
  }

  // ===================== TRIGGERS =====================
  function isMobileLike() { return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0; }

  let motionWatchdog = null;
  function armMotionWatchdog() {
    clearTimeout(motionWatchdog);
    motionWatchdog = setTimeout(() => { manualShakeBtn.classList.remove('hidden'); }, 7000);
  }

  function attemptAsk() {
    unlockAudioOnce();
    if (isMobileLike() && MBShake.isSupported()) {
      ensureMotionPermission((granted) => {
        setHintLines('Задай вопрос в уме...', granted ? 'Теперь потряси телефон 🔮' : 'Нажми «Потрясти шар вручную»');
        if (granted) { startMotionListening(); armMotionWatchdog(); }
      });
    } else {
      runRevealSequence({ level: 'medium', special: null });
    }
  }

  askBtn.addEventListener('click', attemptAsk);
  manualShakeBtn.addEventListener('click', () => {
    unlockAudioOnce();
    runRevealSequence({ level: 'medium', special: null });
  });

  questionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); attemptAsk(); } });
  document.addEventListener('keydown', (e) => {
    if (e.target === questionInput) return;
    if (e.code === 'Space') { e.preventDefault(); attemptAsk(); }
  });

  // ===================== BALL CLICK EASTER EGG =====================
  const bumpBallClicks = MBUI.createClickCounter(7, () => {
    MBUI.showToast('✨ Что-то шевельнулось внутри шара...');
    MBBall.burstParticles(30, '--glow-c', 1.3);
    MBAudio.playAlert();
  });
  ballWrap.addEventListener('click', () => { bumpBallClicks(); MBAudio.playClick(); });
  MBUI.enableBallDrag(ballWrap);

  // ===================== DAILY PROPHECY =====================
  const dailyBtn = $('daily-prophecy-btn');
  if (dailyBtn) {
    dailyBtn.addEventListener('click', () => {
      const result = MBEnergy.claimDailyProphecy(() => MBAnswers.getRandomAnswer({ luckBoost: 0.3 }));
      const stats = getStats();
      stats.claimedDaily = true;
      saveStats(stats);
      evaluateAchievements();
      const panel = $('daily-prophecy-text');
      const dateEl = $('daily-prophecy-date');
      if (panel) panel.textContent = result.text;
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
      MBUI.showModal('daily-prophecy-modal');
      if (result.isNew) { MBAudio.playReveal(result.rarity); MBVibration.reveal(result.rarity); }
    });
  }
  const dailyCloseBtn = $('daily-prophecy-close');
  if (dailyCloseBtn) dailyCloseBtn.addEventListener('click', () => MBUI.hideModal('daily-prophecy-modal'));

  // ===================== RESULT ACTIONS =====================
  $('share-btn').addEventListener('click', async () => {
    const answer = resultActions.dataset.answer;
    const result = await MBShare.shareAnswer(answer);
    if (result === 'copied') MBUI.showToast('Скопировано в буфер обмена 📋');
  });
  $('copy-btn').addEventListener('click', async () => {
    const answer = resultActions.dataset.answer;
    await MBShare.copyToClipboard(MBShare.buildShareText(answer));
    MBUI.showToast('Скопировано 📋');
  });
  $('card-btn').addEventListener('click', () => {
    const canvas = $('card-canvas');
    const style = getComputedStyle(document.body);
    MBShare.renderCard(canvas, {
      question: questionInput.value.trim(),
      answer: resultActions.dataset.answer,
      rarity: resultActions.dataset.rarity,
      themeColors: { a: style.getPropertyValue('--glow-a').trim(), b: style.getPropertyValue('--glow-b').trim() }
    });
    MBUI.showModal('card-modal');
  });
  $('card-close-btn').addEventListener('click', () => MBUI.hideModal('card-modal'));
  $('card-download-btn').addEventListener('click', () => MBShare.downloadCanvas($('card-canvas'), 'magic-ball-answer.png'));

  // ===================== PANELS / NAV =====================
  MBUI.wireCloseButtons();
  $('settings-btn').addEventListener('click', () => MBUI.openPanel('settings-panel'));
  $('history-btn').addEventListener('click', () => { MBHistory.render($('history-list')); MBUI.openPanel('history-panel'); });
  $('stats-btn').addEventListener('click', () => { renderStats(); MBUI.openPanel('stats-panel'); });
  $('achievements-btn').addEventListener('click', () => { MBAchievements.render($('achievements-list')); MBUI.openPanel('achievements-panel'); });
  $('theme-btn').addEventListener('click', () => MBUI.openPanel('settings-panel'));

  $('open-history').addEventListener('click', () => { MBHistory.render($('history-list')); MBUI.openPanel('history-panel'); });
  $('open-achievements').addEventListener('click', () => { MBAchievements.render($('achievements-list')); MBUI.openPanel('achievements-panel'); });
  $('open-stats').addEventListener('click', () => { renderStats(); MBUI.openPanel('stats-panel'); });

  $('clear-history-btn').addEventListener('click', () => {
    MBHistory.clear();
    MBHistory.render($('history-list'));
    MBUI.showToast('История очищена');
  });

  const resetDataBtn = $('reset-data-btn');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (!confirm('Полностью сбросить все данные (историю, статистику, достижения, темы)? Это необратимо.')) return;
      ['mb_stats', 'mb_history', 'mb_achievements', 'mb_theme', 'mb_energy', 'mb_combo', 'mb_daily', 'mb_usage_count']
        .forEach(k => MBStorage.remove(k));
      MBUI.showToast('Данные сброшены');
      location.reload();
    });
  }

  // ===================== SETTINGS WIRING =====================
  MBUI.wireSettingsToggles({
    onSoundChange: (v) => { MBAudio.setEnabled(v); if (v) MBAudio.startAmbient(); else MBAudio.stopAmbient(); },
    onVibrationChange: (v) => MBVibration.setEnabled(v),
    onEffectsChange: () => {},
    onAnimationsChange: (v) => MBBall.setAnimationsEnabled(v),
    onModeChange: (mode) => { MBThemes.applyDayNight(mode); MBBall.reseedStars(); }
  });

  const cinematicToggle = $('toggle-cinematic-skip');
  if (cinematicToggle) {
    cinematicToggle.checked = MBStorage.get('mb_cinematic_mode', 'full') === 'auto_skip_after_uses';
    cinematicToggle.addEventListener('change', () => {
      MBStorage.set('mb_cinematic_mode', cinematicToggle.checked ? 'auto_skip_after_uses' : 'full');
    });
  }

  MBThemes.renderThemePicker($('theme-grid'));

  // ===================== ONBOARDING =====================
  function maybeShowOnboarding() {
    if (MBStorage.get('hasSeenOnboarding', false)) return;
    MBUI.showModal('onboarding-modal');
  }
  const onboardingDone = $('onboarding-done-btn');
  if (onboardingDone) {
    onboardingDone.addEventListener('click', () => {
      MBStorage.set('hasSeenOnboarding', true);
      MBUI.hideModal('onboarding-modal');
    });
  }

  // ===================== DEBUG MODE (hidden, 5 quick taps on logo) =====================
  const debugTrigger = MBUI.createClickCounter(6, () => toggleDebug());
  const logo = document.querySelector('.logo');
  if (logo) logo.addEventListener('click', debugTrigger);
  let debugOn = false, debugPanel = null, lastFrameT = performance.now(), fps = 0;
  function toggleDebug() {
    debugOn = !debugOn;
    if (debugOn) {
      debugPanel = document.createElement('div');
      debugPanel.id = 'debug-panel';
      document.body.appendChild(debugPanel);
    } else if (debugPanel) { debugPanel.remove(); debugPanel = null; }
  }
  function debugLoop(t) {
    fps = Math.round(1000 / Math.max(1, t - lastFrameT));
    lastFrameT = t;
    if (debugOn && debugPanel) {
      debugPanel.textContent = `FPS: ${fps} · tier: ${MBEffects.getTier()} · energy: ${Math.round(MBEnergy.getEnergy())}% · stage class: ${ballWrap.className.match(/stage-\d/) || '-'}`;
    }
    requestAnimationFrame(debugLoop);
  }
  requestAnimationFrame(debugLoop);

  // ===================== INIT =====================
  function init() {
    MBThemes.applyTheme(MBThemes.getCurrentTheme());
    MBThemes.applyDayNight(MBStorage.get('mb_daymode', 'auto'));
    MBBall.init();
    resetIdleTimer();
    requestAnimationFrame(idleLoop);
    renderEnergy();
    maybeShowOnboarding();

    if (dailyBtn) dailyBtn.classList.toggle('claimed', MBEnergy.hasClaimedToday());

    if (isMobileLike() && MBShake.isSupported() && !MBShake.needsPermission()) {
      startMotionListening();
      armMotionWatchdog();
      setHintLines('Задай вопрос в уме...', 'Теперь потряси телефон 🔮');
    } else if (isMobileLike() && MBShake.isSupported()) {
      setHintLines('Задай вопрос в уме...', 'Нажми «Спросить», чтобы разрешить магию');
    } else {
      setHintLines('Задай вопрос в уме...', 'Нажми «Спросить», чтобы получить предсказание');
    }

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
          console.warn('[MagicBall] Service worker не удалось зарегистрировать.');
        });
      });
    }
  }

  init();
})();
