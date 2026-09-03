/* answers.js — v2.0 answer library: 11 categories, 7 rarity tiers,
   contextual keyword matching, weighted no-repeat history, secret triggers */
(function (global) {

  // ===================== RARITY =====================
  // common < uncommon < rare < epic < legendary < mythic < secret
  const RARITY_WEIGHTS = {
    common: 52,
    uncommon: 26,
    rare: 13,
    epic: 6,
    legendary: 2.3,
    mythic: 0.6,
    secret: 0.08
  };

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'secret'];

  const RARITY_META = {
    common:    { label: '',            color: '--r-common',    particles: 0 },
    uncommon:  { label: 'Uncommon',    color: '--r-uncommon',  particles: 10 },
    rare:      { label: 'Rare',        color: '--r-rare',      particles: 22 },
    epic:      { label: 'Epic',        color: '--r-epic',      particles: 38 },
    legendary: { label: 'Legendary',   color: '--r-legendary', particles: 65 },
    mythic:    { label: 'Mythic',      color: '--r-mythic',    particles: 95 },
    secret:    { label: 'Secret',      color: '--r-secret',    particles: 80 }
  };

  // ===================== ANSWER POOL =====================
  // category: yes | no | maybe | mystical | funny | dark | chaotic | wisdom | romantic | luck | secret
  const A = [];
  function add(text, category, rarity) { A.push({ text, category, rarity }); }

  // ---------- YES ----------
  ['Да.', 'Да, определённо.', 'Без сомнений — да.', 'Можешь на это рассчитывать.',
   'Всё складывается в твою пользу.', 'Да, и довольно скоро.', 'Смело иди вперёд.',
   'Так и будет.', 'Хороший момент для этого.', 'Всё получится.', 'Да — доверься процессу.',
   'Верный шаг.', 'Да, действуй.', 'Шансы очень высоки.', 'Это хороший знак.',
   'Иди на это.', 'Да, тебе стоит попробовать.', 'Скорее да, чем нет.', 'Похоже на «да».',
   'Да, я почти уверен.'].forEach(t => add(t, 'yes', 'common'));
  ['Звёзды говорят — да.', 'Вселенная согласна с тобой.', 'Знаки складываются в «да».',
   'Это судьбоносное «да».', 'Ветер перемен дует в твою сторону.', 'Путь открыт — иди.',
   'Да, и это принесёт больше, чем ты ждёшь.'].forEach(t => add(t, 'yes', 'uncommon'));
  ['Туман расступается — там свет и «да».', 'Три знака подряд говорят одно: да.',
   'Редко бывает так однозначно. Да.'].forEach(t => add(t, 'yes', 'rare'));
  ['Да. И это изменит многое.', 'ДА — и путь назад уже закрыт.'].forEach(t => add(t, 'yes', 'epic'));
  add('ТЫ ПОЛУЧИШЬ БОЛЬШЕ, ЧЕМ ПРОСИШЬ.', 'yes', 'legendary');
  add('СУДЬБА УЖЕ СКАЗАЛА «ДА» ЗА ТЕБЯ.', 'yes', 'mythic');

  // ---------- NO ----------
  ['Нет.', 'Определённо нет.', 'Лучше не надо.', 'Не рассчитывай на это.',
   'Похоже, ответ — нет.', 'Не сейчас.', 'Сомневаюсь.', 'Это не то, что тебе нужно.',
   'Отступи, пока не поздно.', 'Шансы малы.', 'Путь закрыт.', 'Пока рано ждать «да».',
   'Не время для этого.', 'Слишком рискованно.', 'Стоит пересмотреть план.',
   'Нет, и не переспрашивай.', 'Скорее нет, чем да.', 'Не в этот раз.',
   'Знаки против тебя.', 'Нет — доверься мне.'].forEach(t => add(t, 'no', 'common'));
  ['Тени качают головой.', 'Это «нет», которое тебя спасёт.', 'Дверь закрылась не просто так.',
   'Что-то важное говорит тебе остановиться.', 'Не сегодня, и, возможно, не скоро.'].forEach(t => add(t, 'no', 'uncommon'));
  ['Всё внутри шара застыло на этом вопросе. Нет.',
   'Это «нет» — единственное, в чём я уверен.'].forEach(t => add(t, 'no', 'rare'));
  ['Абсолютное, тяжёлое «нет».', 'НЕТ. И спрашивать снова бессмысленно.'].forEach(t => add(t, 'no', 'epic'));
  add('ОСТАНОВИСЬ, ПОКА НЕ СТАЛО ХУЖЕ.', 'no', 'legendary');
  add('НЕКОТОРЫЕ ДВЕРИ ЛУЧШЕ НЕ ОТКРЫВАТЬ.', 'no', 'mythic');

  // ---------- MAYBE ----------
  ['Может быть.', 'Спроси позже.', 'Пока слишком рано знать.', 'Всё зависит от тебя.',
   'Сложно сказать наверняка.', 'Подожди знака.', 'Ответ ещё не готов.', 'Спроси иначе.',
   'Время покажет.', 'Ни да, ни нет.', 'Пятьдесят на пятьдесят.', 'Наблюдай и жди.',
   'Туман ещё не рассеялся.', 'Это решать не мне.', 'Возможно, но не наверняка.',
   'Половина знаков за, половина против.', 'Сейчас вселенная молчит.'].forEach(t => add(t, 'maybe', 'common'));
  ['Ответ появится, когда ты перестанешь спрашивать.', 'Весы ещё качаются.',
   'Всё решится в последний момент.'].forEach(t => add(t, 'maybe', 'uncommon'));
  ['Даже я не хочу торопить этот ответ.', 'Судьба ещё пишет эту главу.'].forEach(t => add(t, 'maybe', 'rare'));
  add('ОТВЕТ СУЩЕСТВУЕТ, НО ЕЩЁ НЕ РОДИЛСЯ.', 'maybe', 'epic');

  // ---------- MYSTICAL ----------
  ['Тени говорят — да.', 'Я вижу это в будущем.', 'Судьба уже решила.',
   'Ответ скрыт за завесой.', 'Энергия говорит — да.', 'Не тревожь то, что спит.',
   'Нити судьбы уже сплетены.', 'Звёзды шепчут об этом.', 'Древние силы согласны.',
   'Пелена приоткрылась — и там свет.', 'Луна знает больше меня.', 'Знаки уже вокруг тебя.',
   'Круг ещё не замкнулся.'].forEach(t => add(t, 'mystical', 'common'));
  ['Голос из глубины шепчет «да».', 'То, что скрыто, скоро откроется.',
   'Три пути ведут к одному ответу.', 'Что-то древнее уже знает ответ.'].forEach(t => add(t, 'mystical', 'uncommon'));
  ['Круг замкнулся. Ответ найден.', 'За завесой было тише, чем обычно — это важный знак.'].forEach(t => add(t, 'mystical', 'rare'));
  add('ТУМАН РАССЕЯЛСЯ. ТЫ ГОТОВ.', 'mystical', 'legendary');
  add('ВСЕЛЕННАЯ РЕДКО ГОВОРИТ ТАК ЯСНО.', 'mystical', 'legendary');
  add('ТЫ КОСНУЛСЯ ЧЕГО-ТО, ЧТО ДРЕВНЕЕ ТЕБЯ.', 'mystical', 'mythic');

  // ---------- FUNNY ----------
  ['Я бы на твоём месте не рисковал.', 'Ты серьёзно это спрашиваешь?', 'Шар устал. Спроси позже.',
   'Да... но зачем?', 'Мне кажется, ты уже знаешь ответ.', 'Да, если повезёт.',
   'Нет. Даже не обсуждается.', 'Спроси у мамы.', 'Шар закатывает глаза.',
   'Это было предсказуемо.', 'Ты точно готов услышать ответ?', 'Загугли лучше.',
   'Шар делает вид, что думает.', 'Да, но не благодари.', 'Ответ: возможно, но вряд ли.',
   'Может, стоит выспаться и спросить снова.', 'Шар молчит из вежливости.',
   'Обратись к специалисту, я всего лишь шар.', 'Ставлю всё своё стекло на «нет».'].forEach(t => add(t, 'funny', 'common'));
  ['Шар смеётся над этим вопросом.', 'Даже туман внутри в замешательстве.',
   'Кажется, я такое уже где-то слышал.'].forEach(t => add(t, 'funny', 'uncommon'));
  add('Ты уже спрашивал это. Дважды.', 'funny', 'rare');
  add('ШАР ОФИЦИАЛЬНО ОТКАЗЫВАЕТСЯ ОТВЕЧАТЬ НА ЭТО.', 'funny', 'epic');

  // ---------- DARK ----------
  ['Кто-то там, снаружи, уже знает ответ.', 'Не всё стоит знать заранее.',
   'Тьма внутри шара сгущается — будь осторожен.', 'Это решение будет стоить тебе больше, чем кажется.',
   'Некоторые вопросы лучше не задавать вслух.', 'Что-то холодное коснулось твоего вопроса.',
   'В глубине шара шевельнулось нечто без имени.'].forEach(t => add(t, 'dark', 'common'));
  ['Ты уверен, что хочешь знать правду?', 'Цена ответа выше, чем ты думаешь.'].forEach(t => add(t, 'dark', 'uncommon'));
  add('ОНИ УЖЕ ЗНАЮТ, ЧТО ТЫ СПРОСИЛ.', 'dark', 'rare');
  add('НЕ ВСЁ, ЧТО СПИТ, СТОИТ БУДИТЬ.', 'dark', 'epic');
  add('ЧТО-ТО ВНУТРИ ШАРА ОТКРЫЛО ГЛАЗА.', 'dark', 'legendary');

  // ---------- CHAOTIC ----------
  ['Да. Нет. И то, и другое. Спроси по-другому.', 'Ответ есть, но он не для тебя сегодня.',
   'Реальность на секунду моргнула — ответ изменился.', 'Спроси левой рукой. Шучу. Или нет.',
   'Всё возможно, ничего не гарантировано.', 'Шар видит семь ответов сразу.'].forEach(t => add(t, 'chaotic', 'common'));
  ['Ответ существует во всех вариантах одновременно.', 'Задай вопрос ещё раз — иначе.'].forEach(t => add(t, 'chaotic', 'uncommon'));
  add('ВСЕ ВОЗМОЖНЫЕ ОТВЕТЫ ВЕРНЫ ОДНОВРЕМЕННО.', 'chaotic', 'epic');
  add('ТЫ ЗАДАЛ ВОПРОС, КОТОРОГО ЕЩЁ НЕ БЫЛО.', 'chaotic', 'mythic');

  // ---------- WISDOM ----------
  ['Ответ живёт внутри тебя, а не внутри шара.', 'Иногда важнее не ответ, а сам вопрос.',
   'Слушай тишину между словами.', 'То, что ты ищешь, уже рядом.',
   'Терпение — тоже ответ.', 'Не каждый путь нужно пройти до конца.',
   'Сомнение — тоже часть пути.', 'Мудрость приходит после вопроса, а не вместо него.'].forEach(t => add(t, 'wisdom', 'common'));
  ['Тот, кто спрашивает искренне, уже знает половину ответа.',
   'Путь важнее пункта назначения.'].forEach(t => add(t, 'wisdom', 'uncommon'));
  add('НАСТОЯЩИЙ ОТВЕТ ПРИДЁТ, КОГДА ТЫ ПЕРЕСТАНЕШЬ ЕГО ИСКАТЬ.', 'wisdom', 'epic');
  add('ТЫ УЖЕ ЗНАЛ ЭТОТ ОТВЕТ ДО ТОГО, КАК СПРОСИЛ.', 'wisdom', 'legendary');

  // ---------- ROMANTIC ----------
  ['Сердце уже подсказало тебе ответ.', 'Да, чувства не обманывают.',
   'Это чувство стоит того, чтобы рискнуть.', 'Люби смело — шар на твоей стороне.',
   'Не бойся сказать это первым.', 'Это взаимно, поверь.', 'Пока рано открывать сердце полностью.',
   'Подожди чуть дольше — время имеет значение.'].forEach(t => add(t, 'romantic', 'common'));
  ['Две линии судьбы сходятся ближе, чем кажется.', 'Это чувство настоящее.'].forEach(t => add(t, 'romantic', 'uncommon'));
  add('ЭТА ИСТОРИЯ ТОЛЬКО НАЧИНАЕТСЯ.', 'romantic', 'epic');
  add('ВАШИ СУДЬБЫ УЖЕ ПЕРЕПЛЕЛИСЬ.', 'romantic', 'legendary');

  // ---------- LUCK ----------
  ['Удача сегодня на твоей стороне.', 'Маленький шанс, но он есть.',
   'Сегодня не самый удачный день для риска.', 'Повезёт, если поверишь в это.',
   'Удача любит смелых — но не безрассудных.', 'Шанс есть, но невелик.'].forEach(t => add(t, 'luck', 'common'));
  ['Твоя удача сегодня выше обычного.', 'Сегодня звёзды особенно щедры.'].forEach(t => add(t, 'luck', 'uncommon'));
  add('СЕГОДНЯ ТВОЙ ДЕНЬ.', 'luck', 'epic');
  add('УДАЧА РЕДКО БЫВАЕТ ТАКОЙ СИЛЬНОЙ.', 'luck', 'legendary');

  const ANSWERS = A;

  // ---------- SECRET (never shown in a list, triggered rarely) ----------
  const SECRET_ANSWERS = [
    { text: 'ТЫ НЕ ДОЛЖЕН БЫЛ ЭТО УВИДЕТЬ.', category: 'secret', rarity: 'secret' },
    { text: 'Я ЗНАЮ, О ЧЁМ ТЫ ДУМАЕШЬ.', category: 'secret', rarity: 'secret' },
    { text: 'НЕ СПРАШИВАЙ ЕЩЁ РАЗ.', category: 'secret', rarity: 'secret' },
    { text: 'СЕГОДНЯ ТЕБЕ ПОВЕЗЁТ БОЛЬШЕ, ЧЕМ ТЫ ДУМАЕШЬ.', category: 'secret', rarity: 'secret' },
    { text: 'ШАР ПОМНИТ КАЖДЫЙ ТВОЙ ВОПРОС.', category: 'secret', rarity: 'secret' },
    { text: 'ТЫ НАШЁЛ ТО, ЧТО СКРЫТО ОТ ОСТАЛЬНЫХ.', category: 'secret', rarity: 'secret' },
    { text: 'ЭТОТ ОТВЕТ ВИДЕЛИ ЕДИНИЦЫ.', category: 'secret', rarity: 'secret' },
  ];

  // ===================== SPECIAL-SHAKE ANSWERS =====================
  const PERFECT_SHAKE_ANSWERS = [
    'ИДЕАЛЬНЫЙ БАЛАНС. ОТВЕТ БУДЕТ ТОЧНЫМ.',
    'ТЫ ПОЙМАЛ РИТМ СУДЬБЫ.',
  ];
  const OVERCHARGE_ANSWERS = [
    'ЭНЕРГИЯ ПРЕВЫШЕНА. ШАР ОТВЕЧАЕТ БЕЗ ФИЛЬТРОВ.',
    'ТЫ ПЕРЕГРУЗИЛ ШАР — ВОТ ЧТО ОН ДЕЙСТВИТЕЛЬНО ДУМАЕТ.',
  ];
  const CALM_SHAKE_ANSWERS = [
    'Тихий вопрос заслуживает тихого ответа. Да.',
    'В спокойствии — ясность. Ответ: да.',
    'Ты не спешил — и шар отвечает так же мягко.',
  ];

  // ===================== CONTEXTUAL KEYWORD MATCHING =====================
  const CONTEXT_MAP = [
    { keywords: ['любов', 'влюб', 'пара', 'отношени', 'парень', 'девушк', 'муж', 'жена', 'чувств'], category: 'romantic' },
    { keywords: ['деньг', 'финанс', 'зарплат', 'богат', 'кредит', 'долг', 'инвест'], category: 'luck' },
    { keywords: ['работ', 'карьер', 'начальник', 'собеседован', 'увол', 'проект'], category: 'wisdom' },
    { keywords: ['экзамен', 'учёб', 'учеб', 'сессия', 'универ', 'школ', 'зачёт'], category: 'wisdom' },
    { keywords: ['купить', 'покупк', 'заказать', 'приобрес'], category: 'yes' },
    { keywords: ['игра', 'ставк', 'казино', 'выигр'], category: 'luck' },
  ];

  function detectContextCategory(question) {
    if (!question) return null;
    const q = question.toLowerCase();
    for (const rule of CONTEXT_MAP) {
      if (rule.keywords.some(k => q.includes(k))) return rule.category;
    }
    return null;
  }

  // ===================== RARITY PICK =====================
  function pickWeightedRarity(luckBoost = 0) {
    const weights = { ...RARITY_WEIGHTS };
    // luckBoost (0..1) shifts probability mass toward rarer tiers
    if (luckBoost > 0) {
      ['rare', 'epic', 'legendary', 'mythic'].forEach(r => { weights[r] *= (1 + luckBoost * 1.8); });
      weights.common *= (1 - luckBoost * 0.3);
    }
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const rarity of RARITY_ORDER) {
      if (r < weights[rarity]) return rarity;
      r -= weights[rarity];
    }
    return 'common';
  }

  function poolFor(rarity, category) {
    let list = rarity === 'secret' ? SECRET_ANSWERS : ANSWERS.filter(a => a.rarity === rarity);
    if (category && rarity !== 'secret') {
      const inCategory = list.filter(a => a.category === category);
      if (inCategory.length) return inCategory;
    }
    return list;
  }

  // ===================== WEIGHTED NO-REPEAT HISTORY =====================
  // recentTexts: array of last N answer texts (most recent first)
  function pickFromPool(candidates, recentTexts) {
    if (!candidates.length) return null;
    if (!recentTexts || !recentTexts.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    // weight down recently-seen answers
    const weighted = candidates.map(c => {
      const recentIndex = recentTexts.indexOf(c.text);
      let w = 1;
      if (recentIndex === 0) w = 0.05; // just seen — near-excluded
      else if (recentIndex > 0) w = 0.35 + recentIndex * 0.1;
      return { c, w };
    });
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    for (const item of weighted) {
      if (r < item.w) return item.c;
      r -= item.w;
    }
    return candidates[candidates.length - 1];
  }

  // main entry point
  function getRandomAnswer(opts) {
    opts = opts || {};
    const recentTexts = opts.recentTexts || [];
    const luckBoost = opts.luckBoost || 0;
    const forceCategory = opts.forceCategory || detectContextCategory(opts.question);

    let rarity = pickWeightedRarity(luckBoost);
    let candidates = poolFor(rarity, forceCategory);
    if (!candidates.length) { rarity = 'common'; candidates = poolFor('common', forceCategory); }

    let choice = pickFromPool(candidates, recentTexts);
    if (!choice) choice = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    return { ...choice, rarity };
  }

  function pickSpecial(list, rarity) {
    const text = list[Math.floor(Math.random() * list.length)];
    return { text, category: 'secret', rarity: rarity || 'epic' };
  }

  global.MBAnswers = {
    ANSWERS, SECRET_ANSWERS,
    RARITY_ORDER, RARITY_META, RARITY_WEIGHTS,
    getRandomAnswer,
    detectContextCategory,
    perfectShakeAnswer: () => pickSpecial(PERFECT_SHAKE_ANSWERS, 'epic'),
    overchargeAnswer: () => pickSpecial(OVERCHARGE_ANSWERS, 'legendary'),
    calmShakeAnswer: () => pickSpecial(CALM_SHAKE_ANSWERS, 'uncommon'),
    totalCount: ANSWERS.length + SECRET_ANSWERS.length
  };
})(window);
