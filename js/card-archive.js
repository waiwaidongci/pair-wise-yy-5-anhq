/* 上机织造卡 —— 历史存放（localStorage：当前卡 + 作废留档） */
(function () {
  const KEY = "zfl31WeaveCards";
  const ARCHIVE_LIMIT = 30; // 留档上限，超出丢弃最旧

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "null");
      if (data && Array.isArray(data.archive)) {
        return { current: data.current || null, archive: data.archive };
      }
    } catch (e) { /* 存档损坏时从空状态重来 */ }
    return { current: null, archive: [] };
  }

  function persist(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function archiveCurrent(state, reason) {
    const card = state.current;
    if (!card) return;
    card.status = "void";
    card.voidedAt = new Date().toISOString();
    card.voidReason = reason;
    state.archive.unshift(card);
    if (state.archive.length > ARCHIVE_LIMIT) state.archive.length = ARCHIVE_LIMIT;
    state.current = null;
  }

  function getState() {
    return load();
  }

  // 新草稿顶替旧草稿；若当前是已确认卡，先作废留档再顶替
  function saveDraft(card) {
    const state = load();
    if (state.current && state.current.status === "confirmed") {
      archiveCurrent(state, "已被新卡顶替");
    }
    card.status = "draft";
    state.current = card;
    persist(state);
    return state;
  }

  // 确认当前草稿卡
  function confirmCurrent() {
    const state = load();
    if (!state.current || state.current.status !== "draft") return state;
    state.current.status = "confirmed";
    state.current.confirmedAt = new Date().toISOString();
    persist(state);
    return state;
  }

  // 画布再变：已确认卡作废并留档；草稿不动，仍只留草稿
  function voidIfConfirmed(reason) {
    const state = load();
    if (state.current && state.current.status === "confirmed") {
      archiveCurrent(state, reason);
      persist(state);
    }
    return state;
  }

  window.CardArchive = {
    getState: getState,
    saveDraft: saveDraft,
    confirmCurrent: confirmCurrent,
    voidIfConfirmed: voidIfConfirmed,
  };
})();
