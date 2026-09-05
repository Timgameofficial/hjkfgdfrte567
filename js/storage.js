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

  global.MBStorage = { get, set, remove, isAvailable: () => available };
})(window);
