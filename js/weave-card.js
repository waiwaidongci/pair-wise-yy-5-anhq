/* 上机织造卡 —— 卡片计算（纯函数，不碰页面与存储） */
(function () {
  const MAX_LIFT_ROWS = 4; // 单个经线通道允许的最大连续提综行数

  // 网格指纹：行列 + 全部格色，用来判断画布是否又变过
  function fingerprint(cols, rows, cells) {
    const text = cols + "x" + rows + ":" + cells.join(",");
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  }

  // 一行之内连续同色投梭合成一段，start 为 1 起始的经线通道号
  function buildRowSegments(cells, cols, y) {
    const segments = [];
    let x = 0;
    while (x < cols) {
      const color = cells[y * cols + x];
      let end = x + 1;
      while (end < cols && cells[y * cols + end] === color) end++;
      segments.push({ color, start: x + 1, count: end - x });
      x = end;
    }
    return segments;
  }

  // 单通道同一色线连续提综超过四行的区段，需在卡上标出（底色为地组织，不算提综；换色即断）
  function findLongLifts(cells, cols, rows) {
    const lifts = [];
    for (let x = 0; x < cols; x++) {
      let runStart = 0;
      for (let y = 1; y <= rows; y++) {
        const same = y < rows && cells[y * cols + x] === cells[runStart * cols + x];
        if (same) continue;
        const color = cells[runStart * cols + x];
        const count = y - runStart;
        if (color !== 0 && count > MAX_LIFT_ROWS) {
          lifts.push({ channel: x + 1, color: color, fromRow: runStart + 1, toRow: y, count: count });
        }
        runStart = y;
      }
    }
    return lifts;
  }

  // 从当前网格生成织造卡（草稿）：横行提综队列 + 每格对应经线通道
  function buildCard(cols, rows, cells) {
    const snapshot = cells.slice();
    const queue = [];
    for (let y = 0; y < rows; y++) {
      queue.push({ row: y + 1, segments: buildRowSegments(snapshot, cols, y) });
    }
    return {
      id: "card-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36),
      cols: cols,
      rows: rows,
      cells: snapshot,
      fingerprint: fingerprint(cols, rows, snapshot),
      queue: queue,
      longLifts: findLongLifts(snapshot, cols, rows),
      pendingCells: snapshot.filter(function (v) { return v === 0; }).length, // 色线未处理格数
      createdAt: new Date().toISOString(),
    };
  }

  // 对照当前画布评估卡片：能否确认、卡在哪些条件上
  function evaluate(card, cols, rows, cells) {
    const dimsMatch = card.cols === cols && card.rows === rows;
    const contentMatch = dimsMatch && card.fingerprint === fingerprint(cols, rows, cells);
    const problems = [];
    if (!dimsMatch) {
      problems.push("行列与卡片不符（卡片 " + card.cols + "×" + card.rows + "，画布 " + cols + "×" + rows + "），请重新生成");
    } else if (!contentMatch) {
      problems.push("画布内容已变，与卡片不符，请重新生成");
    }
    if (card.pendingCells > 0) problems.push("还有 " + card.pendingCells + " 格色线未处理");
    if (card.longLifts.length > 0) {
      problems.push(card.longLifts.length + " 处通道连续提综超过四行，调好再确认");
    }
    return { dimsMatch: dimsMatch, contentMatch: contentMatch, problems: problems, canConfirm: problems.length === 0 };
  }

  window.WeaveCard = {
    MAX_LIFT_ROWS: MAX_LIFT_ROWS,
    fingerprint: fingerprint,
    buildCard: buildCard,
    evaluate: evaluate,
  };
})();
