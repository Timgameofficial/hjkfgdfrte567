/* storage.js — safe localStorage wrapper with in-memory fallback */
(function (global) {
  const MEMORY = {};
  let available = true;

  try {
    const testKey = '__mb_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
  } catch (e) {
    available = false;
    console.warn('[MagicBall] LocalStorage недоступен, используется временное хранилище памяти.');
  }

  function get(key, fallback) {
    try {
      if (available) {
        const raw = window.localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      }
      return key in MEMORY ? MEMORY[key] : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      if (available) {
        window.localStorage.setItem(key, JSON.stringify(value));
      } else {
        MEMORY[key] = value;
      }
      return true;
    } catch (e) {
      MEMORY[key] = value;
      return false;
    }
  }

  function remove(key) {
    try {
      if (available) window.localStorage.removeItem(key);
      delete MEMORY[key];
    } catch (e) { /* noop */ }
  }

  // ---- schema-safe reads for growing/persisted objects (stats, progression, etc.) ----
  // Plain get() with a fallback only helps when the KEY is entirely missing.
  // If the key exists but was saved by an older version of the app — before a
  // field like `recentTexts` or `categoryCounts.mystic` existed — the raw
  // stored object silently lacks that field, and code that assumes it's
  // there (e.g. `s.recentTexts.unshift(...)`) throws. getMerged() shallow-
  // merges defaults UNDER whatever was actually stored, so every top-level
  // field defaults() declares is guaranteed to exist, while real stored data
  // is preserved untouched. (Nested per-key maps like rarityCounts are
  // already written defensively elsewhere with `|| 0` fallbacks, so a
  // shallow merge is sufficient here — no deep-merge complexity needed.)
  function getMerged(key, defaults) {
    const stored = get(key, null);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      return JSON.parse(JSON.stringify(defaults));
    }
    return Object.assign({}, defaults, stored);
  }

  // ---- lightweight schema version marker, for future migrations ----
  // Bump DATA_VERSION and add a migration step here if a future release
  // needs to transform old saved shapes rather than just fill in defaults.
  const DATA_VERSION = 1;
  function getDataVersion() { return get('mb_data_version', 0); }
  function markDataVersion() { set('mb_data_version', DATA_VERSION); }
  markDataVersion(); // no migrations defined yet — just stamp the current version

  global.MBStorage = {
    get, set, remove, isAvailable: () => available,
    getMerged, getDataVersion, DATA_VERSION
  };
})(window);
