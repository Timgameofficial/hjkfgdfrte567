/* answers.js — answer database, categories & rarity weighting */
(function (global) {

  // rarity: common | rare | epic | legendary | secret
  // category: positive | negative | neutral | funny | mystic
  const ANSWERS = [
    // ---------- POSITIVE (common) ----------
    { text: 'Да.', category: 'positive', rarity: 'common' },
    { text: 'Определённо да.', category: 'positive', rarity: 'common' },
    { text: 'Без сомнений.', category: 'positive', rarity: 'common' },
    { text: 'Это хороший знак.', category: 'positive', rarity: 'common' },
    { text: 'Можешь рассчитывать на это.', category: 'positive', rarity: 'common' },
    { text: 'Шансы очень высоки.', category: 'positive', rarity: 'common' },
    { text: 'Всё складывается в твою пользу.', category: 'positive', rarity: 'common' },
    { text: 'Да, и довольно скоро.', category: 'positive', rarity: 'common' },
    { text: 'Смело иди вперёд.', category: 'positive', rarity: 'common' },
    { text: 'Звёзды на твоей стороне.', category: 'positive', rarity: 'common' },
    { text: 'Так и будет.', category: 'positive', rarity: 'common' },
    { text: 'Да, я почти уверен.', category: 'positive', rarity: 'common' },
    { text: 'Хороший момент для этого.', category: 'positive', rarity: 'common' },
    { text: 'Всё получится.', category: 'positive', rarity: 'common' },
    { text: 'Да — доверься процессу.', category: 'positive', rarity: 'common' },
    // ---------- POSITIVE (rare/epic/legendary) ----------
    { text: 'Вселенная говорит — да.', category: 'positive', rarity: 'rare' },
    { text: 'Это судьбоносное «да».', category: 'positive', rarity: 'rare' },
    { text: 'Да. И это изменит многое.', category: 'positive', rarity: 'epic' },
    { text: 'ТЫ ПОЛУЧИШЬ БОЛЬШЕ, ЧЕМ ПРОСИШЬ.', category: 'positive', rarity: 'legendary' },

    // ---------- NEGATIVE (common) ----------
    { text: 'Нет.', category: 'negative', rarity: 'common' },
    { text: 'Определённо нет.', category: 'negative', rarity: 'common' },
    { text: 'Лучше не надо.', category: 'negative', rarity: 'common' },
    { text: 'Не рассчитывай на это.', category: 'negative', rarity: 'common' },
    { text: 'Знаки против тебя.', category: 'negative', rarity: 'common' },
    { text: 'Похоже, ответ — нет.', category: 'negative', rarity: 'common' },
    { text: 'Не сейчас.', category: 'negative', rarity: 'common' },
    { text: 'Сомневаюсь.', category: 'negative', rarity: 'common' },
    { text: 'Это не то, что тебе нужно.', category: 'negative', rarity: 'common' },
    { text: 'Нет, и не переспрашивай.', category: 'negative', rarity: 'common' },
    { text: 'Отступи, пока не поздно.', category: 'negative', rarity: 'common' },
    { text: 'Шансы малы.', category: 'negative', rarity: 'common' },
    { text: 'Нет — доверься мне.', category: 'negative', rarity: 'common' },
    { text: 'Путь закрыт.', category: 'negative', rarity: 'common' },
    { text: 'Пока рано ждать «да».', category: 'negative', rarity: 'common' },
    // ---------- NEGATIVE (rare/epic) ----------
    { text: 'Тени качают головой.', category: 'negative', rarity: 'rare' },
    { text: 'Это «нет», которое тебя спасёт.', category: 'negative', rarity: 'rare' },
    { text: 'Абсолютное, тяжёлое «нет».', category: 'negative', rarity: 'epic' },
    { text: 'ОСТАНОВИСЬ, ПОКА НЕ СТАЛО ХУЖЕ.', category: 'negative', rarity: 'epic' },

    // ---------- NEUTRAL (common) ----------
    { text: 'Спроси позже.', category: 'neutral', rarity: 'common' },
    { text: 'Пока слишком рано знать.', category: 'neutral', rarity: 'common' },
    { text: 'Ответ скрыт от тебя.', category: 'neutral', rarity: 'common' },
    { text: 'Всё зависит от тебя.', category: 'neutral', rarity: 'common' },
    { text: 'Сейчас вселенная молчит.', category: 'neutral', rarity: 'common' },
    { text: 'Сложно сказать наверняка.', category: 'neutral', rarity: 'common' },
    { text: 'Подожди знака.', category: 'neutral', rarity: 'common' },
    { text: 'Может быть.', category: 'neutral', rarity: 'common' },
    { text: 'Ответ ещё не готов.', category: 'neutral', rarity: 'common' },
    { text: 'Спроси иначе.', category: 'neutral', rarity: 'common' },
    { text: 'Время покажет.', category: 'neutral', rarity: 'common' },
    { text: 'Сфокусируйся и спроси снова.', category: 'neutral', rarity: 'common' },
    { text: 'Ни да, ни нет.', category: 'neutral', rarity: 'common' },
    { text: 'Туман ещё не рассеялся.', category: 'neutral', rarity: 'common' },
    { text: 'Это решать не мне.', category: 'neutral', rarity: 'common' },
    // ---------- NEUTRAL (rare) ----------
    { text: 'Ответ появится, когда ты перестанешь спрашивать.', category: 'neutral', rarity: 'rare' },
    { text: 'Весы ещё качаются.', category: 'neutral', rarity: 'rare' },

    // ---------- FUNNY (common) ----------
    { text: 'Я бы на твоём месте не рисковал.', category: 'funny', rarity: 'common' },
    { text: 'Ты серьёзно это спрашиваешь?', category: 'funny', rarity: 'common' },
    { text: 'Шар устал. Спроси позже.', category: 'funny', rarity: 'common' },
    { text: 'Да... но зачем?', category: 'funny', rarity: 'common' },
    { text: 'Мне кажется, ты уже знаешь ответ.', category: 'funny', rarity: 'common' },
    { text: 'Да, если повезёт.', category: 'funny', rarity: 'common' },
    { text: 'Нет. Даже не обсуждается.', category: 'funny', rarity: 'common' },
    { text: 'Спроси у мамы.', category: 'funny', rarity: 'common' },
    { text: 'Шар закатывает глаза.', category: 'funny', rarity: 'common' },
    { text: 'Это было предсказуемо.', category: 'funny', rarity: 'common' },
    { text: 'Ты точно готов услышать ответ?', category: 'funny', rarity: 'common' },
    { text: 'Загугли лучше.', category: 'funny', rarity: 'common' },
    { text: 'Шар делает вид, что думает.', category: 'funny', rarity: 'common' },
    { text: 'Да, но не благодари.', category: 'funny', rarity: 'common' },
    { text: 'Ответ: возможно, но вряд ли.', category: 'funny', rarity: 'common' },
    // ---------- FUNNY (rare/epic) ----------
    { text: 'Шар смеётся над этим вопросом.', category: 'funny', rarity: 'rare' },
    { text: 'Даже туман внутри в замешательстве.', category: 'funny', rarity: 'rare' },
    { text: 'Ты уже спрашивал это. Дважды.', category: 'funny', rarity: 'epic' },

    // ---------- MYSTIC (common) ----------
    { text: 'Тени говорят — да.', category: 'mystic', rarity: 'common' },
    { text: 'Я вижу это в будущем.', category: 'mystic', rarity: 'common' },
    { text: 'Судьба уже решила.', category: 'mystic', rarity: 'common' },
    { text: 'Ответ скрыт за завесой.', category: 'mystic', rarity: 'common' },
    { text: 'Энергия говорит — да.', category: 'mystic', rarity: 'common' },
    { text: 'Не тревожь то, что спит.', category: 'mystic', rarity: 'common' },
    { text: 'Нити судьбы уже сплетены.', category: 'mystic', rarity: 'common' },
    { text: 'Звёзды шепчут об этом.', category: 'mystic', rarity: 'common' },
    { text: 'Древние силы согласны.', category: 'mystic', rarity: 'common' },
    { text: 'Пелена приоткрылась — и там свет.', category: 'mystic', rarity: 'common' },
    // ---------- MYSTIC (rare/epic/legendary) ----------
    { text: 'Голос из глубины шепчет «да».', category: 'mystic', rarity: 'rare' },
    { text: 'То, что скрыто, скоро откроется.', category: 'mystic', rarity: 'rare' },
    { text: 'Три пути ведут к одному ответу.', category: 'mystic', rarity: 'rare' },
    { text: 'Круг замкнулся. Ответ найден.', category: 'mystic', rarity: 'epic' },
    { text: 'ТУМАН РАССЕЯЛСЯ. ТЫ ГОТОВ.', category: 'mystic', rarity: 'legendary' },
    { text: 'ВСЕЛЕННАЯ РЕДКО ГОВОРИТ ТАК ЯСНО.', category: 'mystic', rarity: 'legendary' },

    // more common filler across categories to comfortably exceed 100 unique
    { text: 'Да, действуй.', category: 'positive', rarity: 'common' },
    { text: 'Верный шаг.', category: 'positive', rarity: 'common' },
    { text: 'Всё идёт по плану.', category: 'positive', rarity: 'common' },
    { text: 'Не время для этого.', category: 'negative', rarity: 'common' },
    { text: 'Слишком рискованно.', category: 'negative', rarity: 'common' },
    { text: 'Стоит пересмотреть план.', category: 'negative', rarity: 'common' },
    { text: 'Наблюдай и жди.', category: 'neutral', rarity: 'common' },
    { text: 'Спроси у сердца, не у шара.', category: 'neutral', rarity: 'common' },
    { text: 'Пятьдесят на пятьдесят.', category: 'neutral', rarity: 'common' },
    { text: 'Может, стоит выспаться и спросить снова.', category: 'funny', rarity: 'common' },
    { text: 'Шар молчит из вежливости.', category: 'funny', rarity: 'common' },
    { text: 'Луна знает больше меня.', category: 'mystic', rarity: 'common' },
    { text: 'Знаки уже вокруг тебя.', category: 'mystic', rarity: 'common' },
  ];

  // Secret / critical answers — extremely rare, unique animation
  const SECRET_ANSWERS = [
    { text: 'ТЫ НЕ ДОЛЖЕН БЫЛ ЭТО УВИДЕТЬ.', category: 'mystic', rarity: 'secret' },
    { text: 'Я ЗНАЮ, О ЧЁМ ТЫ ДУМАЕШЬ.', category: 'mystic', rarity: 'secret' },
    { text: 'НЕ СПРАШИВАЙ ЕЩЁ РАЗ.', category: 'mystic', rarity: 'secret' },
    { text: 'СЕГОДНЯ ТЕБЕ ПОВЕЗЁТ.', category: 'positive', rarity: 'secret' },
  ];

  const RARITY_WEIGHTS = {
    common: 70,
    rare: 22,
    epic: 6.5,
    legendary: 1.4,
    secret: 0.1
  };

  function pickWeightedRarity() {
    const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
      if (r < weight) return rarity;
      r -= weight;
    }
    return 'common';
  }

  function pool(rarity) {
    if (rarity === 'secret') return SECRET_ANSWERS;
    return ANSWERS.filter(a => a.rarity === rarity);
  }

  // returns an answer object, avoiding immediate repeats of the same text
  function getRandomAnswer(lastText) {
    let rarity = pickWeightedRarity();
    let candidates = pool(rarity);

    // graceful fallback if a tier pool is empty
    if (!candidates.length) {
      rarity = 'common';
      candidates = pool('common');
    }

    let choice = candidates[Math.floor(Math.random() * candidates.length)];

    // avoid exact repeat back-to-back when possible
    if (candidates.length > 1 && lastText && choice.text === lastText) {
      let attempts = 0;
      while (choice.text === lastText && attempts < 6) {
        choice = candidates[Math.floor(Math.random() * candidates.length)];
        attempts++;
      }
    }
    return choice;
  }

  global.MBAnswers = {
    ANSWERS,
    SECRET_ANSWERS,
    getRandomAnswer,
    totalCount: ANSWERS.length + SECRET_ANSWERS.length
  };
})(window);
