/* history.js — question/answer history with rarity filters, persisted to localStorage */
(function (global) {
  const KEY = 'mb_history';
  const MAX_ITEMS = 300;

  function getAll() { return MBStorage.get(KEY, []); }

  function add(entry) {
    const list = getAll();
    list.unshift({
      question: entry.question || '(мысленный вопрос)',
      answer: entry.answer,
      category: entry.category,
      rarity: entry.rarity,
      theme: entry.theme,
      shakeIntensity: entry.shakeIntensity,
      date: new Date().toISOString()
    });
    if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
    MBStorage.set(KEY, list);
    return list;
  }

  function clear() { MBStorage.set(KEY, []); }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const RARITY_LABEL = { uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic', secret: 'Secret' };

  function render(container, filter) {
    filter = filter || 'all';
    const items = getAll().filter(item => filter === 'all' ? true : item.rarity === filter);
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<p class="empty-state">История пуста.<br>Задай свой первый вопрос 🔮</p>';
      return;
    }
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      const rTag = RARITY_LABEL[item.rarity]
        ? `<span class="rarity-tag rarity-${item.rarity}">${RARITY_LABEL[item.rarity]}</span>` : '';
      el.innerHTML = `
        <div class="h-q">${escapeHtml(item.question)}</div>
        <div class="h-a">${escapeHtml(item.answer)}</div>
        <div class="h-meta"><span>${formatDate(item.date)}</span>${rTag}</div>
      `;
      container.appendChild(el);
    });
  }

  global.MBHistory = { getAll, add, clear, render };
})(window);
