/* 上机织造卡 · 卡片计算：提综队列、草稿判定、超长提综标记（纯函数，不碰页面与存储） */
(function (global) {
  "use strict";

  const BLANK_COLOR = 0;   // 色线库 0 号为底色，留在格子里视为色线未处理
  const MAX_LIFT_ROWS = 4; // 单个通道允许的最大连续提综行数

  // 一行内连续同色的格子合成一段投梭；每格对应一个经线通道（从 1 数起）
  function buildRowSegments(cols, rowCells) {
    const segments = [];
    let x = 0;
    while (x < cols) {
      const color = rowCells[x];
      let end = x;
      while (end + 1 < cols && rowCells[end + 1] === color) end++;
      segments.push({ color: color, from: x + 1, to: end + 1, count: end - x + 1 });
      x = end + 1;
    }
    return segments;
  }

  // 横行提综队列：逐行列出本行各段投梭的色线与通道范围
  function buildQueue(cols, rows, cells) {
    const queue = [];
    for (let y = 0; y < rows; y++) {
      queue.push({ row: y + 1, segments: buildRowSegments(cols, cells.slice(y * cols, y * cols + cols)) });
    }
    return queue;
  }

  // 单通道同一色线连续提综超过 MAX_LIFT_ROWS 行的，逐通道标出
  function findOverLifts(cols, rows, cells) {
    const flags = [];
    for (let x = 0; x < cols; x++) {
      let runColor = BLANK_COLOR, start = 0, len = 0;
      for (let y = 0; y <= rows; y++) {
        const c = y < rows ? cells[y * cols + x] : BLANK_COLOR; // 末尾补一刀，强制结算上一段
        if (c !== BLANK_COLOR && c === runColor) {
          len++;
        } else {
          if (runColor !== BLANK_COLOR && len > MAX_LIFT_ROWS) {
            flags.push({ channel: x + 1, color: runColor, fromRow: start + 1, toRow: start + len, rows: len });
          }
          runColor = c;
          start = y;
          len = c === BLANK_COLOR ? 0 : 1;
        }
      }
    }
    return flags;
  }

  // 画布指纹：行列与全部格子，用来判断画布是否和卡片对得上
  function fingerprint(state) {
    return state.cols + "x" + state.rows + ":" + state.cells.join("");
  }

  // 从当前网格生成一张卡（生成时不定草稿/确认，由 draftReasons / canConfirm 判定）
  function buildCard(state) {
    return {
      cols: state.cols,
      rows: state.rows,
      fingerprint: fingerprint(state),
      queue: buildQueue(state.cols, state.rows, state.cells),
      overLifts: findOverLifts(state.cols, state.rows, state.cells),
      untreatedCells: state.cells.reduce(function (n, v) { return n + (v === BLANK_COLOR ? 1 : 0); }, 0),
      createdAt: Date.now()
    };
  }

  // 只留草稿的原因：色线未处理，或画布行列/纹样与卡片不符
  function draftReasons(card, current) {
    const reasons = [];
    if (!card) return reasons;
    if (card.untreatedCells > 0) reasons.push("有 " + card.untreatedCells + " 格色线未处理");
    if (current) {
      if (current.cols !== card.cols || current.rows !== card.rows) {
        reasons.push("行列与卡片不符（卡片 " + card.cols + "×" + card.rows + "，画布 " + current.cols + "×" + current.rows + "）");
      } else if (fingerprint(current) !== card.fingerprint) {
        reasons.push("画布纹样与卡片不符");
      }
    }
    return reasons;
  }

  // 能确认的条件：无草稿原因，且没有超长提综（调好再确认）
  function canConfirm(card, current) {
    return !!card && draftReasons(card, current).length === 0 && card.overLifts.length === 0;
  }

  global.WeaveCard = {
    BLANK_COLOR: BLANK_COLOR,
    MAX_LIFT_ROWS: MAX_LIFT_ROWS,
    buildCard: buildCard,
    draftReasons: draftReasons,
    canConfirm: canConfirm,
    fingerprint: fingerprint
  };
})(window);
