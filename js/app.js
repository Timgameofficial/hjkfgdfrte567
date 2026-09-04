/* app.js — orchestrates the whole experience */
(function () {
  const $ = (id) => document.getElementById(id);

  const ballWrap = $('ball-wrap');
  const ballText = $('ball-text');
  const questionInput = $('question-input');
  const askBtn = $('ask-btn');
  const manualShakeBtn = $('manual-shake-btn');
  const hintLine1 = $('hint-line-1');
  const hintLine2 = $('hint-line-2');
  const resultActions = $('result-actions');

  let isRevealing = false;
  let lastAnswerText = null;
  let motionPermissionResolved = false;
  let idleTimer = null;
  let audioUnlockedOnce = false;

  // ===================== STATS =====================
  const STATS_KEY = 'mb_stats';
  function defaultStats() {
    return {
      totalQuestions: 0,
      categoryCounts: { positive: 0, negative: 0, neutral: 0, funny: 0, mystic: 0 },
      rarityCounts: { common: 0, rare: 0, epic: 0, legendary: 0, secret: 0 },
      daysUsed: [],
      sessionStreak: 0,
      maxStreak: 0,
      answerFrequency: {}
    };
  }
  function getStats() { return MBStorage.get(STATS_KEY, defaultStats()); }
  function saveStats(s) { MBStorage.set(STATS_KEY, s); }

  function recordAnswer(answerObj) {
    const s = getStats();
    s.totalQuestions++;
    s.categoryCounts[answerObj.category] = (s.categoryCounts[answerObj.category] || 0) + 1;
    s.rarityCounts[answerObj.rarity] = (s.rarityCounts[answerObj.rarity] || 0) + 1;

    const today = new Date().toISOString().slice(0, 10);
    if (!s.daysUsed.includes(today)) s.daysUsed.push(today);

    s.sessionStreak++;
    s.maxStreak = Math.max(s.maxStreak, s.sessionStreak);

    s.answerFrequency[answerObj.text] = (s.answerFrequency[answerObj.text] || 0) + 1;

    saveStats(s);
    return s;
  }

  function repeatedAnswerHits(stats) {
    return Object.values(stats.answerFrequency).reduce((sum, c) => sum + Math.max(0, c - 1), 0);
  }

  function legendaryCount(stats) {
    return (stats.rarityCounts.legendary || 0) + (stats.rarityCounts.secret || 0);
  }

  function renderStats() {
    const s = getStats();
    const grid = $('stats-grid');
    const rarest = ['secret', 'legendary', 'epic', 'rare', 'common'].find(r => s.rarityCounts[r] > 0) || '—';
    const rarestLabel = { secret: 'Секретный', legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common', '—': '—' }[rarest];
    grid.innerHTML = `
      <div class="stat-card wide"><div class="stat-num">${s.totalQuestions}</div><div class="stat-label">Всего вопросов задано</div></div>
      <div class="stat-card"><div class="stat-num">${s.categoryCounts.positive}</div><div class="stat-label">Положительных</div></div>
      <div class="stat-card"><div class="stat-num">${s.categoryCounts.negative}</div><div class="stat-label">Отрицательных</div></div>
      <div class="stat-card"><div class="stat-num">${s.categoryCounts.neutral + s.categoryCounts.funny + s.categoryCounts.mystic}</div><div class="stat-label">Неопределённых</div></div>
      <div class="stat-card"><div class="stat-num">${(s.rarityCounts.rare||0)+(s.rarityCounts.epic||0)+(s.rarityCounts.legendary||0)+(s.rarityCounts.secret||0)}</div><div class="stat-label">Редких ответов</div></div>
      <div class="stat-card wide"><div class="stat-num">${rarestLabel}</div><div class="stat-label">Самый редкий найденный ответ</div></div>
      <div class="stat-card wide"><div class="stat-num">${s.daysUsed.length}</div><div class="stat-label">Дней использования</div></div>
    `;
  }

  // ===================== ACHIEVEMENTS =====================
  function evaluateAchievements() {
    const s = getStats();
    const snapshot = {
      totalQuestions: s.totalQuestions,
      legendaryCount: legendaryCount(s),
      maxStreak: s.maxStreak,
      repeatedAnswerHits: repeatedAnswerHits(s)
    };
    MBAchievements.evaluate(snapshot, (def) => {
      MBUI.showToast(`🏆 Достижение: «${def.title}»`);
    });
  }

  // ===================== IDLE HINT =====================
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

  function setHintLines(l1, l2) {
    hintLine1.textContent = l1;
    hintLine2.textContent = l2;
  }

  // ===================== PERMISSION FLOW =====================
  function ensureMotionPermission(cb) {
    if (motionPermissionResolved || !MBShake.needsPermission()) {
      cb(true);
      return;
    }
    MBUI.showModal('permission-modal');
    const allowBtn = $('allow-motion-btn');
    const skipBtn = $('skip-motion-btn');

    const onAllow = async () => {
      const result = await MBShake.requestPermission();
      motionPermissionResolved = true;
      MBUI.hideModal('permission-modal');
      cleanup();
      if (result === 'granted') {
        startMotionListening();
        cb(true);
      } else {
        manualShakeBtn.classList.remove('hidden');
        cb(false);
      }
    };
    const onSkip = () => {
      motionPermissionResolved = true;
      MBUI.hideModal('permission-modal');
      cleanup();
      manualShakeBtn.classList.remove('hidden');
      cb(false);
    };
    function cleanup() {
      allowBtn.removeEventListener('click', onAllow);
      skipBtn.removeEventListener('click', onSkip);
    }
    allowBtn.addEventListener('click', onAllow);
    skipBtn.addEventListener('click', onSkip);
  }

  // ===================== MOTION LISTENING =====================
  let lastStage = 'idle';
  function startMotionListening() {
    MBShake.start(
      (level, meta) => { clearTimeout(motionWatchdog); runShakeSequence(level, meta); },
      (state) => {
        clearTimeout(motionWatchdog);
        // continuous feedback (spec §14-17): drive the ball's glow/vortex/core
        // straight off shakeIntensity/shakeEnergy every sample, independent of
        // whether a full reveal sequence has actually triggered yet.
        document.documentElement.style.setProperty('--shake-intensity', state.intensity.toFixed(3));
        document.documentElement.style.setProperty('--shake-energy', state.energy.toFixed(3));
        if (window.MBPhysics) window.MBPhysics.setShakeIntensity(state.intensity);
        MBBall.setVortexSpeed(1 + state.intensity * 7);

        if (!isRevealing && state.stage !== lastStage) {
          lastStage = state.stage;
          const uiLevel = state.stage === 'idle' || state.stage === 'light' ? null
            : (state.stage === 'medium' ? 'weak' : state.stage === 'strong' ? 'medium' : 'strong');
          ballWrap.classList.remove('shake-weak', 'shake-medium', 'shake-strong');
          if (uiLevel) {
            ballWrap.classList.add('shake-' + uiLevel);
            MBAudio.playShakeTick(uiLevel === 'strong' ? 2 : uiLevel === 'medium' ? 1.3 : 0.7);
          }
        }
      }
    );
    MBBall.enableOrientationParallax();
  }

  // ===================== CORE REVEAL SEQUENCE =====================
  const STAGE_TEXTS = ['Сканирование судьбы...', 'Анализ вероятностей...', 'Ответ найден.'];

  function runShakeSequence(level, meta) {
    if (isRevealing) return;
    isRevealing = true;
    resetIdleTimer();
    resultActions.classList.add('hidden');
    ballWrap.classList.remove('idle-pulse');

    unlockAudioOnce();
    MBAudio.startAmbient();
    MBAudio.playWhoosh();
    MBAudio.playSpin();

    const isStrong = level === 'strong';
    const isMedium = level === 'medium';

    ballWrap.classList.add('shaking', 'shake-' + level);
    if (isMedium || isStrong) MBEffects.screenShake(isStrong ? 900 : 500);
    MBBall.burstParticles(isStrong ? 40 : isMedium ? 22 : 10, '--glow-a', isStrong ? 1.6 : 1);
    MBVibration.shakeTick(isStrong ? 3 : isMedium ? 2 : 1);

    // Perfect Shake / Overcharge (spec §18-19) — special-cased on top of the
    // normal reveal, without derailing it.
    if (meta && meta.overcharge) {
      MBUI.showToast('⚡ OVERCHARGE');
      MBEffects.screenShake(700);
      MBVibration.fire([30, 20, 30, 20, 30, 20, 90]);
    } else if (meta && meta.perfect) {
      MBUI.showToast('✨ PERFECT SHAKE');
      MBBall.burstParticles(26, '--glow-c', 1.5);
      MBVibration.fire([20, 30, 20, 30, 60]);
    }

    setHintLines('', '');
    ballText.textContent = '';

    const shakeDuration = isStrong ? 1500 : isMedium ? 1100 : 800;

    // periodic shake ticks (sound/vibration) during the spin
    let tickCount = 0;
    const maxTicks = Math.round(shakeDuration / 180);
    const tickInterval = setInterval(() => {
      tickCount++;
      MBAudio.playShakeTick(isStrong ? 1.8 : 1);
      if (tickCount >= maxTicks) clearInterval(tickInterval);
    }, 180);

    setTimeout(() => {
      ballWrap.classList.remove('shaking', 'shake-weak', 'shake-medium', 'shake-strong');
      MBBall.setCoreState('compress');
      MBBall.collapseVortex(true);
      runStageTexts(0, level);
    }, shakeDuration);
  }

  function runStageTexts(index, level) {
    if (index >= STAGE_TEXTS.length) {
      revealAnswer(level);
      return;
    }
    ballText.classList.remove('legendary-text');
    ballText.style.opacity = '0';
    setTimeout(() => {
      ballText.textContent = STAGE_TEXTS[index];
      ballText.style.opacity = '.85';
    }, 120);
    setTimeout(() => runStageTexts(index + 1, level), 620);
  }

  function revealAnswer(level) {
    const answerObj = MBAnswers.getRandomAnswer(lastAnswerText);
    lastAnswerText = answerObj.text;

    MBEffects.flashBall();
    MBEffects.spawnShockwave();
    MBAudio.playReveal(answerObj.rarity);
    MBVibration.reveal(answerObj.rarity);

    MBBall.setCoreState('bloom');
    document.documentElement.style.setProperty('--shake-intensity', '0');
    document.documentElement.style.setProperty('--shake-energy', '0');
    setTimeout(() => {
      MBBall.setCoreState('idle');
      MBBall.collapseVortex(false);
      MBBall.setVortexSpeed(1);
    }, 900);

    if (answerObj.rarity === 'rare') {
      MBBall.burstParticles(24, '--rare-color', 1.2);
    } else if (answerObj.rarity === 'epic') {
      MBBall.burstParticles(36, '--epic-color', 1.4);
      pulseBallGlassColor();
    } else if (answerObj.rarity === 'legendary') {
      MBBall.burstParticles(70, '--legendary-color', 1.8);
      MBEffects.legendaryScreenFlash();
      pulseBallGlassColor(true);
    } else if (answerObj.rarity === 'secret') {
      MBBall.burstParticles(50, '--legendary-color', 1.6);
      glitchReveal();
    }

    ballText.style.opacity = '0';
    setTimeout(() => {
      ballText.textContent = answerObj.text;
      ballText.classList.toggle('legendary-text', answerObj.rarity === 'legendary' || answerObj.rarity === 'secret');
      ballText.style.opacity = '1';
    }, 150);

    const stats = recordAnswer(answerObj);
    MBHistory.add({
      question: questionInput.value.trim(),
      answer: answerObj.text,
      category: answerObj.category,
      rarity: answerObj.rarity
    });
    evaluateAchievements();
    updateHintForResult(answerObj);

    resultActions.classList.remove('hidden');
    resultActions.dataset.answer = answerObj.text;
    resultActions.dataset.rarity = answerObj.rarity;

    isRevealing = false;
  }

  function pulseBallGlassColor(strong) {
    const glass = $('ball-glass');
    glass.style.filter = strong ? 'brightness(1.6) saturate(1.4)' : 'brightness(1.25) saturate(1.2)';
    setTimeout(() => { glass.style.filter = ''; }, strong ? 1400 : 900);
  }

  function glitchReveal() {
    document.body.style.transition = 'filter .08s';
    let n = 0;
    const t = setInterval(() => {
      document.body.style.filter = n % 2 === 0 ? 'invert(1)' : '';
      n++;
      if (n > 4) { clearInterval(t); document.body.style.filter = ''; }
    }, 70);
  }

  function updateHintForResult() {
    setHintLines('Задай новый вопрос в уме...', 'Потряси телефон ещё раз 🔮');
  }

  function unlockAudioOnce() {
    if (audioUnlockedOnce) return;
    audioUnlockedOnce = true;
    MBAudio.unlock();
  }

  // ===================== TRIGGERS =====================
  function isMobileLike() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  }

  // Safety net: if we start listening for real shakes but none arrive
  // (sensor exists but user isn't actually shaking / emulator / edge case),
  // reveal the manual button so the user is never stuck.
  let motionWatchdog = null;
  function armMotionWatchdog() {
    clearTimeout(motionWatchdog);
    motionWatchdog = setTimeout(() => {
      manualShakeBtn.classList.remove('hidden');
    }, 7000);
  }

  function attemptAsk() {
    unlockAudioOnce();
    if (isMobileLike() && MBShake.isSupported()) {
      ensureMotionPermission((granted) => {
        setHintLines('Задай вопрос в уме...', granted ? 'Теперь потряси телефон 🔮' : 'Нажми «Потрясти шар вручную»');
        if (granted) { startMotionListening(); armMotionWatchdog(); }
      });
    } else {
      // Desktop or no motion sensors: the button itself performs the prediction
      runShakeSequence('medium');
    }
  }

  askBtn.addEventListener('click', attemptAsk);
  manualShakeBtn.addEventListener('click', () => {
    unlockAudioOnce();
    MBShake.triggerManual('medium');
    runShakeSequence('medium');
  });

  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptAsk(); }
  });

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

  // ===================== SETTINGS WIRING =====================
  MBUI.wireSettingsToggles({
    onSoundChange: (v) => { MBAudio.setEnabled(v); if (v) MBAudio.startAmbient(); else MBAudio.stopAmbient(); },
    onVibrationChange: (v) => MBVibration.setEnabled(v),
    onEffectsChange: () => {},
    onAnimationsChange: (v) => MBBall.setAnimationsEnabled(v),
    onModeChange: (mode) => { MBThemes.applyDayNight(mode); MBBall.reseedStars(); }
  });

  MBThemes.renderThemePicker($('theme-grid'));

  // ===================== INIT =====================
  function init() {
    MBThemes.applyTheme(MBThemes.getCurrentTheme());
    MBThemes.applyDayNight(MBStorage.get('mb_daymode', 'auto'));
    MBBall.init();
    resetIdleTimer();

    if (isMobileLike() && MBShake.isSupported() && !MBShake.needsPermission()) {
      startMotionListening();
      armMotionWatchdog();
      setHintLines('Задай вопрос в уме...', 'Теперь потряси телефон 🔮');
    } else if (isMobileLike() && MBShake.isSupported()) {
      setHintLines('Задай вопрос в уме...', 'Нажми «Спросить», чтобы разрешить магию');
    } else {
      // Desktop / no touch: the ask button itself is the prediction trigger
      setHintLines('Задай вопрос в уме...', 'Нажми «Спросить», чтобы получить предсказание');
    }

    // register service worker for offline support (only on http/https)
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
