/* memory.js — question memory: normalizes questions, remembers what was asked
   before, and detects exact repeats + lightweight "similar" matches so the
   Ball can reference the past ("Ты уже спрашивал это", echo/paradox events)
   without needing any external AI. Pure local string matching. */
(function (global) {
  const KEY = 'mb_qmemory';
  const MAX_ENTRIES = 200;

  function defaultState() { return { entries: [] }; }
  function getState() { return MBStorage.getMerged(KEY, defaultState()); }
  function saveState(s) { MBStorage.set(KEY, s); }

  // lowercase, trim, collapse whitespace, strip trailing/leading punctuation —
  // "Стоит ли мне ЭТО делать???" and "стоит ли мне это делать" should match
  function normalize(question) {
    if (!question) return '';
    return question
      .toLowerCase()
      .trim()
      .replace(/[?!.,;:…"'«»]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // cheap word-overlap similarity (Jaccard over word sets) — good enough to
  // flag "basically the same question" without any external NLP/AI
  function similarity(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.split(' ').filter(w => w.length > 1));
    const setB = new Set(b.split(' ').filter(w => w.length > 1));
    if (!setA.size || !setB.size) return 0;
    let shared = 0;
    setA.forEach(w => { if (setB.has(w)) shared++; });
    return shared / new Set([...setA, ...setB]).size;
  }

  function findEntry(norm, entries) {
    return entries.find(e => e.qNorm === norm) || null;
  }
  function findSimilar(norm, entries, excludeNorm) {
    let best = null, bestScore = 0;
    for (const e of entries) {
      if (e.qNorm === excludeNorm) continue;
      const score = similarity(norm, e.qNorm);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return bestScore >= 0.8 ? best : null;
  }

  // Records a question+answer, returns what the app needs to know to react:
  //   isRepeat        — exact same normalized question asked before
  //   repeatCount      — how many times (including this one)
  //   priorAnswer      — the answer given last time (for "echo"/"paradox")
  //   priorCategory    — category of that prior answer
  //   similarPrior     — a near-duplicate question asked before (if no exact repeat)
  function recordQuestion(rawQuestion, answerObj) {
    const norm = normalize(rawQuestion);
    const state = getState();
    if (!norm) {
      // "(мысленный вопрос)" / empty input — nothing meaningful to remember
      return { isRepeat: false, repeatCount: 0, priorAnswer: null, priorCategory: null, similarPrior: null, norm: '' };
    }

    const existing = findEntry(norm, state.entries);
    const similarPrior = !existing ? findSimilar(norm, state.entries, norm) : null;

    const result = {
      isRepeat: !!existing,
      repeatCount: existing ? existing.count + 1 : 1,
      priorAnswer: existing ? existing.answer : null,
      priorCategory: existing ? existing.category : null,
      priorRarity: existing ? existing.rarity : null,
      similarPrior: similarPrior ? similarPrior.qNorm : null,
      norm
    };

    if (existing) {
      existing.count++;
      existing.lastAsked = Date.now();
      existing.answer = answerObj.text;
      existing.category = answerObj.category;
      existing.rarity = answerObj.rarity;
    } else {
      state.entries.unshift({
        qNorm: norm, count: 1, firstAsked: Date.now(), lastAsked: Date.now(),
        answer: answerObj.text, category: answerObj.category, rarity: answerObj.rarity
      });
      if (state.entries.length > MAX_ENTRIES) state.entries.length = MAX_ENTRIES;
    }
    saveState(state);
    return result;
  }

  function totalUniqueQuestions() { return getState().entries.length; }
  function randomPastEntry() {
    const entries = getState().entries.filter(e => e.qNorm);
    if (!entries.length) return null;
    return entries[Math.floor(Math.random() * entries.length)];
  }

  global.MBMemory = { normalize, recordQuestion, totalUniqueQuestions, randomPastEntry };
})(window);
