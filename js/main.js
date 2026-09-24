/* 页面操作：排版台画布 + 上机织造卡面板的渲染与交互 */
const colors = ["#f7e7c4", "#a6322d", "#1f5f78", "#d6a437", "#355b38", "#713d7b", "#1e1b18", "#e98c52"];
const grid = document.querySelector("#grid");
const palette = document.querySelector("#palette");
const stats = document.querySelector("#stats");
const preview = document.querySelector("#preview");
const risk = document.querySelector("#risk");
let cols = 18, rows = 14, active = 1, block = "dot", dragging = false;
let cells = [];
let undo = [], redo = [];

function init(loadSaved = true) {
  const saved = loadSaved && JSON.parse(localStorage.getItem("zfl31Pattern") || "null");
  if (saved) { cols = saved.cols; rows = saved.rows; cells = saved.cells; }
  else { cols = Number(document.querySelector("#cols").value); rows = Number(document.querySelector("#rows").value); cells = Array(cols * rows).fill(0); }
  document.querySelector("#cols").value = cols; document.querySelector("#rows").value = rows;
  render();
}

function render() {
  palette.innerHTML = colors.map((c, i) => '<button class="swatch ' + (i === active ? 'active' : '') + '" data-color="' + i + '" style="background:' + c + '"></button>').join("");
  palette.querySelectorAll("[data-color]").forEach(el => el.onclick = () => { active = Number(el.dataset.color); render(); });
  grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
  grid.innerHTML = cells.map((v, i) => '<div class="cell" data-i="' + i + '" style="background:' + colors[v] + '"></div>').join("");
  grid.querySelectorAll(".cell").forEach(el => {
    el.onpointerdown = () => { dragging = true; paint(Number(el.dataset.i)); };
    el.onpointerenter = () => { if (dragging) paint(Number(el.dataset.i)); };
  });
  window.onpointerup = () => dragging = false;
  renderStats();
}

function snapshot() { undo.push([...cells]); redo = []; if (undo.length > 50) undo.shift(); }

function paint(i) {
  snapshot();
  const targets = pattern(i);
  targets.forEach(t => { if (t >= 0 && t < cells.length) cells[t] = active; });
  render();
  onCanvasChanged();
}

function pattern(i) {
  const x = i % cols, y = Math.floor(i / cols);
  if (block === "cross") return [i, idx(x - 1, y), idx(x + 1, y), idx(x, y - 1), idx(x, y + 1)].filter(v => v !== null);
  if (block === "diamond") return [idx(x, y - 1), idx(x - 1, y), i, idx(x + 1, y), idx(x, y + 1)].filter(v => v !== null);
  return [i];
}

function idx(x, y) { return x < 0 || x >= cols || y < 0 || y >= rows ? null : y * cols + x; }

function colorName(i) { return i === 0 ? "底色·未处理" : "色线" + i; }

function renderStats() {
  const counts = colors.map((_, i) => cells.filter(v => v === i).length);
  stats.innerHTML = counts.map((n, i) => '<div class="stat"><span><span style="display:inline-block;width:14px;height:14px;background:' + colors[i] + '"></span> ' + colorName(i) + '</span><b>' + n + '</b></div>').join("");
  preview.innerHTML = Array.from({ length: 36 }, (_, i) => '<div class="mini" style="background:' + colors[cells[(i % 6) + Math.floor(i / 6) * cols] || colors[0]] + '"></div>').join("");
  const riskRows = [];
  for (let y = 0; y < rows; y++) {
    let switches = 0;
    for (let x = 1; x < cols; x++) if (cells[y * cols + x] !== cells[y * cols + x - 1]) switches++;
    if (switches > cols * .62) riskRows.push(y + 1);
  }
  risk.innerHTML = riskRows.length ? '<p class="warning">第' + riskRows.join("、") + '行换色过密，可能断线。</p>' : '<p>暂无明显断线风险。</p>';
}

/* ---------- 上机织造卡面板 ---------- */
const notice = document.querySelector("#notice");
const cardStatus = document.querySelector("#cardStatus");
const cardProblems = document.querySelector("#cardProblems");
const cardTotals = document.querySelector("#cardTotals");
const cardQueue = document.querySelector("#cardQueue");
const cardArchiveList = document.querySelector("#cardArchive");
const buildCardBtn = document.querySelector("#buildCardBtn");
const confirmCardBtn = document.querySelector("#confirmCardBtn");
let noticeTimer = null;

function showNotice(msg) {
  notice.textContent = msg;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ""; }, 5000);
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

// 画布再变：已确认卡作废留档；草稿只留草稿，面板提示不符
function onCanvasChanged(reason) {
  const card = CardArchive.getState().current;
  if (card && card.status === "confirmed" && card.fingerprint !== WeaveCard.fingerprint(cols, rows, cells)) {
    CardArchive.voidIfConfirmed(reason || "确认后画布又修改");
    showNotice("画布已变，已确认的织造卡作废并留档。");
  }
  refreshCardPanel();
}

function refreshCardPanel() {
  const state = CardArchive.getState();
  renderCurrentCard(state.current);
  renderArchiveList(state.archive);
}

function renderCurrentCard(card) {
  if (!card) {
    cardStatus.innerHTML = "<p>尚未生成织造卡。排版完成后点击「生成织造卡」。</p>";
    cardProblems.innerHTML = "";
    cardTotals.innerHTML = "";
    cardQueue.innerHTML = "";
    confirmCardBtn.disabled = true;
    return;
  }
  const result = WeaveCard.evaluate(card, cols, rows, cells);
  const confirmed = card.status === "confirmed";
  cardStatus.innerHTML = '<span class="badge ' + (confirmed ? "confirmed" : "draft") + '">' + (confirmed ? "已确认" : "草稿") + "</span>"
    + " <b>" + card.cols + " 通道 × " + card.rows + " 行</b> · 生成于 " + fmtTime(card.createdAt)
    + (card.confirmedAt ? " · 确认于 " + fmtTime(card.confirmedAt) : "");
  if (confirmed) {
    cardProblems.innerHTML = "<p>已确认卡：照卡提综投梭。画布再变将自动作废并留档。</p>";
  } else if (result.problems.length) {
    cardProblems.innerHTML = result.problems.map(p => '<p class="warning">· ' + p + "</p>").join("");
  } else {
    cardProblems.innerHTML = "<p>草稿核对无误，可以确认。</p>";
  }
  confirmCardBtn.disabled = confirmed || !result.canConfirm;
  renderTotals(card);
  renderQueue(card);
}

// 每色投梭次数合计
function renderTotals(card) {
  const counts = colors.map((_, i) => card.cells.filter(v => v === i).length);
  cardTotals.innerHTML = counts.map((n, i) => {
    if (!n) return "";
    const label = i === 0 ? "底色未处理 " + n + " 格" : colorName(i) + " 共投梭 " + n + " 次";
    return '<span class="seg"><span class="dot" style="background:' + colors[i] + '"></span>' + label + "</span>";
  }).join("");
}

// 横行提综队列：每格对应经线通道，连续同色一段；超长提综的段标红
function renderQueue(card) {
  const flagged = {};
  card.longLifts.forEach(l => {
    for (let y = l.fromRow; y <= l.toRow; y++) (flagged[y] = flagged[y] || new Set()).add(l.channel);
  });
  const summary = card.longLifts.length
    ? '<p class="warning">连续提综超四行：' + card.longLifts.map(l => "通道" + l.channel + " 色" + l.color + " 第" + l.fromRow + "–" + l.toRow + "行（连" + l.count + "行）").join("；") + "</p>"
    : "";
  cardQueue.innerHTML = summary + card.queue.map(row => {
    const segs = row.segments.map(s => {
      const end = s.start + s.count - 1;
      const marks = flagged[row.row];
      let warn = false;
      if (marks) for (let ch = s.start; ch <= end; ch++) if (marks.has(ch)) { warn = true; break; }
      return '<span class="seg' + (warn ? " lift-warn" : "") + '"><span class="dot" style="background:' + colors[s.color] + '"></span>'
        + (s.color === 0 ? "底色" : "色" + s.color) + " ×" + s.count
        + " <em>通道" + s.start + (s.count > 1 ? "–" + end : "") + "</em></span>";
    }).join("");
    return '<div class="queue-row"><span class="row-no">第' + row.row + '行</span>' + segs + "</div>";
  }).join("");
}

function renderArchiveList(archive) {
  cardArchiveList.innerHTML = archive.length
    ? archive.map(c => '<div class="archive-item"><span class="badge void">作废</span> <b>' + c.cols + " 通道 × " + c.rows + " 行</b> · 生成于 " + fmtTime(c.createdAt) + " · 作废于 " + fmtTime(c.voidedAt) + " · " + (c.voidReason || "") + "</div>").join("")
    : "<p>暂无留档。</p>";
}

buildCardBtn.onclick = () => {
  const hadConfirmed = (CardArchive.getState().current || {}).status === "confirmed";
  const card = WeaveCard.buildCard(cols, rows, cells);
  CardArchive.saveDraft(card);
  showNotice(hadConfirmed ? "原已确认卡作废留档，新草稿已生成。" : "已生成草稿卡，核对无误后确认。");
  refreshCardPanel();
};

confirmCardBtn.onclick = () => {
  const card = CardArchive.getState().current;
  if (!card || card.status !== "draft") return;
  const result = WeaveCard.evaluate(card, cols, rows, cells);
  if (!result.canConfirm) {
    showNotice("还不能确认：" + result.problems[0]);
    refreshCardPanel();
    return;
  }
  CardArchive.confirmCurrent();
  showNotice("卡片已确认，可以上机；画布再变将自动作废留档。");
  refreshCardPanel();
};

/* ---------- 排版台原有操作 ---------- */
document.querySelectorAll("[data-block]").forEach(btn => btn.onclick = () => block = btn.dataset.block);
document.querySelector("#newBtn").onclick = () => { undo = []; redo = []; init(false); onCanvasChanged(); };
document.querySelector("#undoBtn").onclick = () => { if (!undo.length) return; redo.push([...cells]); cells = undo.pop(); render(); onCanvasChanged(); };
document.querySelector("#redoBtn").onclick = () => { if (!redo.length) return; undo.push([...cells]); cells = redo.pop(); render(); onCanvasChanged(); };
document.querySelector("#saveBtn").onclick = () => localStorage.setItem("zfl31Pattern", JSON.stringify({ cols, rows, cells }));
document.querySelector("#exportBtn").onclick = () => {
  const data = { cols, rows, cells, usage: colors.map((color, i) => ({ color, count: cells.filter(v => v === i).length })) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "brocade-pattern.json"; a.click(); URL.revokeObjectURL(a.href);
};

init();
onCanvasChanged("画布与已确认卡不符"); // 载入时核对：画布与已确认卡不一致同样作废留档
