/* 上机织造卡 · 页面操作：渲染卡片与留档、按钮交互、订阅画布变更 */
(function () {
  "use strict";

  const desk = window.patternDesk;      // 排版台暴露的画布状态与变更通知
  const calc = window.WeaveCard;        // card.js：卡片计算
  const store = window.WeaveCardStore;  // cardStore.js：历史存放

  let current = null;    // 当前卡（草稿或已确认）
  let confirmed = false;

  const $ = function (id) { return document.getElementById(id); };
  const statusEl = $("cardStatus"), reasonsEl = $("cardReasons"), flagsEl = $("cardFlags");
  const queueEl = $("cardQueue"), historyEl = $("cardHistory");
  const genBtn = $("genCardBtn"), confirmBtn = $("confirmCardBtn"), clearBtn = $("clearHistoryBtn");

  function chip(i) {
    return '<span class="chip" style="background:' + desk.colors[i] + '" title="色线' + i + '"></span>';
  }

  // 超长提综覆盖到的「行:通道」集合，用于在队列里标红
  function flagSpots(card) {
    const spots = new Set();
    card.overLifts.forEach(function (f) {
      for (let r = f.fromRow; r <= f.toRow; r++) spots.add(r + ":" + f.channel);
    });
    return spots;
  }

  function renderQueue(card) {
    const spots = flagSpots(card);
    queueEl.innerHTML = card.queue.map(function (row) {
      const segs = row.segments.map(function (seg) {
        let flagged = false;
        for (let ch = seg.from; ch <= seg.to && !flagged; ch++) flagged = spots.has(row.row + ":" + ch);
        return '<span class="qseg' + (flagged ? " flagged" : "") + '">' + chip(seg.color) +
          "通道" + seg.from + (seg.to > seg.from ? "–" + seg.to : "") + " ×" + seg.count + "</span>";
      }).join("");
      return '<div class="qrow"><b>第' + row.row + '行</b><span class="qsegs">' + segs + "</span></div>";
    }).join("");
  }

  function renderFlags(card) {
    flagsEl.innerHTML = card.overLifts.length
      ? '<p class="warning">单通道连续提综超过' + calc.MAX_LIFT_ROWS + "行，请调整后再确认：</p>" +
        card.overLifts.map(function (f) {
          return '<p class="warning">· 通道' + f.channel + " · 色线" + f.color +
            "：第" + f.fromRow + "–" + f.toRow + "行连续" + f.rows + "行</p>";
        }).join("")
      : "";
  }

  function renderCard() {
    const state = desk.getState();
    if (!current) {
      statusEl.innerHTML = '<span class="badge">未生成</span> 点击“生成/重算卡片”从当前网格生成提综队列。';
      reasonsEl.innerHTML = "";
      flagsEl.innerHTML = "";
      queueEl.innerHTML = "";
      confirmBtn.disabled = true;
      return;
    }
    const reasons = calc.draftReasons(current, state);
    statusEl.innerHTML = confirmed
      ? '<span class="badge ok">已确认</span> 可交班上机；画布再改动将自动作废并留档。'
      : '<span class="badge draft">草稿</span> 卡片尺寸 ' + current.cols + "×" + current.rows;
    reasonsEl.innerHTML = !confirmed && reasons.length
      ? '<p class="warning">仅可留草稿：</p>' + reasons.map(function (r) { return '<p class="warning">· ' + r + "</p>"; }).join("")
      : "";
    renderFlags(current);
    renderQueue(current);
    confirmBtn.disabled = confirmed || !calc.canConfirm(current, state);
  }

  function renderHistory() {
    const items = store.list();
    historyEl.innerHTML = items.length
      ? items.map(function (r) {
          const segCount = r.queue.reduce(function (n, row) { return n + row.segments.length; }, 0);
          return '<div class="stat"><span>' + new Date(r.archivedAt).toLocaleString("zh-CN") +
            " · " + r.cols + "×" + r.rows + " · " + segCount + "段<br>" + r.reason +
            '</span><button class="secondary" data-del="' + r.id + '">删除</button></div>';
        }).join("")
      : "<p>暂无留档。</p>";
    historyEl.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () { store.remove(btn.dataset.del); renderHistory(); };
    });
  }

  // 画布每次变更都会走到这里：确认后的卡一旦对不上画布，立即作废留档
  function refresh() {
    const state = desk.getState();
    if (current && confirmed && calc.fingerprint(state) !== current.fingerprint) {
      store.archive(current, "确认后画布变更，旧卡作废留档");
      current = null;
      confirmed = false;
    }
    renderCard();
    renderHistory();
  }

  genBtn.onclick = function () {
    if (current && confirmed) store.archive(current, "重新生成卡片，旧卡留档");
    current = calc.buildCard(desk.getState());
    confirmed = false;
    renderCard();
    renderHistory();
  };

  confirmBtn.onclick = function () {
    if (current && calc.canConfirm(current, desk.getState())) {
      confirmed = true;
      renderCard();
    }
  };

  clearBtn.onclick = function () { store.clear(); renderHistory(); };

  desk.onChange(refresh);
  refresh();
})();
