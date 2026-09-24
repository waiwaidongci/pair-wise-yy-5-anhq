/* 上机织造卡 · 历史存放：作废卡留档（localStorage） */
(function (global) {
  "use strict";

  const KEY = "zfl31CardHistory";
  const MAX_RECORDS = 100;

  function list() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveAll(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  // 把一张卡连同作废原因存入留档，返回档案记录
  function archive(card, reason) {
    const items = list();
    const record = {
      id: "card-" + Date.now() + "-" + items.length,
      archivedAt: Date.now(),
      reason: reason || "画布变更，卡片作废",
      cols: card.cols,
      rows: card.rows,
      fingerprint: card.fingerprint,
      queue: card.queue,
      overLifts: card.overLifts
    };
    items.unshift(record);
    saveAll(items.slice(0, MAX_RECORDS));
    return record;
  }

  function remove(id) {
    saveAll(list().filter(function (r) { return r.id !== id; }));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  global.WeaveCardStore = { list: list, archive: archive, remove: remove, clear: clear };
})(window);
