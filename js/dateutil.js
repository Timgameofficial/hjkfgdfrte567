/* dateutil.js — local-calendar-day helpers.
   IMPORTANT: never derive a user-facing "day" bucket from
   `new Date().toISOString().slice(0, 10)`. toISOString() is UTC-based, so it
   rolls the calendar day over at the wrong local moment for anyone not in the
   UTC timezone — early for zones ahead of UTC, late for zones behind it. That
   silently breaks day streaks, the daily prophecy, and midnight-rollover
   logic (they'd flip at, say, 03:00 or 21:00 local time instead of midnight).
   Use MBDate.todayKey() / MBDate.localDayKey() instead, which read the local
   Y/M/D fields directly. (Storing an absolute *timestamp* as an ISO string,
   e.g. for history entries, is fine — the bug is specifically about deriving
   a calendar-day bucket from it.) */
(function (global) {
  function pad2(n) { return String(n).padStart(2, '0'); }

  function localDayKey(date) {
    date = date || new Date();
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function todayKey() { return localDayKey(new Date()); }

  // whole-day difference between two 'YYYY-MM-DD' local-day keys (a - b),
  // safe across DST since both are parsed as local midnight, not UTC
  function daysBetweenKeys(keyA, keyB) {
    const [ay, am, ad] = keyA.split('-').map(Number);
    const [by, bm, bd] = keyB.split('-').map(Number);
    const a = new Date(ay, am - 1, ad);
    const b = new Date(by, bm - 1, bd);
    return Math.round((a - b) / 86400000);
  }

  function yesterdayKey(fromDate) {
    const d = fromDate ? new Date(fromDate) : new Date();
    d.setDate(d.getDate() - 1);
    return localDayKey(d);
  }

  global.MBDate = { localDayKey, todayKey, daysBetweenKeys, yesterdayKey };
})(window);
