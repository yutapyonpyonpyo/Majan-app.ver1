import {
  DEFAULT_RULES,
  calculateGame,
  formatPt,
  formatScore,
  getPlayerStats,
  getSeries,
  getStandings,
  validateRules,
} from "./calculations.js";

const STORAGE_KEY = "mahjong-scorebook-v1";
const COLORS = ["#e6b84b", "#39a892", "#ee735d", "#6875d1"];
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

let state = loadState();
let route = parseRoute();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.tournaments)) throw new Error("invalid");
    parsed.tournaments = parsed.tournaments.map((tournament) => {
      const rules = {
        ...DEFAULT_RULES,
        ...tournament.rules,
        rankPoints: tournament.rules?.rankPoints || [...DEFAULT_RULES.rankPoints],
      };
      return {
        ...tournament,
        rules,
        games: (tournament.games || []).map((game) => ({
          ...game,
          results: calculateGame(game.scores, rules).results,
        })),
      };
    });
    return parsed;
  } catch {
    return { tournaments: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { page: parts[0] || "home", tournamentId: parts[1], itemId: parts[2] };
}

function navigate(path) {
  location.hash = path;
}

function getTournament(tournamentId = route.tournamentId) {
  return state.tournaments.find((item) => item.id === tournamentId);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function formatDate(value, withTime = false) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function icon(name) {
  const paths = {
    back: '<path d="m15 18-6-6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 11v6M14 11v6"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function shell(content, options = {}) {
  const { title = "麻雀スコア帖", back = false, action = "" } = options;
  app.innerHTML = `
    <div class="site-shell">
      <header class="topbar">
        <div class="topbar-inner">
          ${back ? `<button class="icon-button" data-action="back" aria-label="戻る">${icon("back")}</button>` : `<div class="brand-mark" aria-hidden="true">東</div>`}
          <div class="topbar-title"><span>${escapeHtml(title)}</span></div>
          <div class="topbar-action">${action}</div>
        </div>
      </header>
      <main class="main">${content}</main>
      ${route.page === "home" ? `<footer class="footer">端末内に安全に保存 · オフライン対応</footer>` : ""}
    </div>`;
}

function emptyState() {
  return `
    <section class="hero">
      <div class="hero-pattern" aria-hidden="true"></div>
      <div class="hero-copy">
        <span class="eyebrow">SCORE KEEPER</span>
        <h1>牌卓の記録を、<br><em>美しくシンプルに。</em></h1>
        <p>点数を入れるだけで、順位点も累計も。<br>面倒な計算はすべておまかせ。</p>
        <button class="primary-button light" data-nav="new">${icon("plus")} 最初の大会をつくる</button>
      </div>
      <div class="hero-tiles" aria-hidden="true">
        <div class="tile">一</div><div class="tile offset">發</div><div class="tile">九</div>
      </div>
    </section>
    <section class="feature-grid">
      <article><span class="feature-number">01</span><h2>すぐ計算</h2><p>持ち点から順位点までリアルタイムで算出。</p></article>
      <article><span class="feature-number">02</span><h2>ずっと記録</h2><p>対局の履歴と累計推移を端末に保存。</p></article>
      <article><span class="feature-number">03</span><h2>通信不要</h2><p>一度開けば、圏外の雀荘でも使えます。</p></article>
    </section>`;
}

function renderHome() {
  const tournaments = [...state.tournaments].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );
  if (!tournaments.length) {
    shell(emptyState(), {
      action: `<button class="icon-button" data-nav="new" aria-label="大会を作成">${icon("plus")}</button>`,
    });
    return;
  }
  const cards = tournaments
    .map((tournament) => {
      const standings = getStandings(tournament);
      const leader = standings[0];
      return `
        <button class="tournament-card" data-nav="tournament/${tournament.id}">
          <div class="card-topline">
            <span class="game-count">${tournament.games.length} 半荘</span>
            <span class="muted">${formatDate(tournament.updatedAt)}</span>
          </div>
          <h2>${escapeHtml(tournament.name)}</h2>
          <div class="card-players">${tournament.players.map((player) => `<span>${escapeHtml(player.name)}</span>`).join("")}</div>
          <div class="leader-row">
            <span class="leader-label">${icon("trophy")} 現在の首位</span>
            <strong>${escapeHtml(leader.name)}</strong>
            <b class="${leader.total >= 0 ? "positive" : "negative"}">${formatPt(leader.total)} pt</b>
            ${icon("chevron")}
          </div>
        </button>`;
    })
    .join("");
  shell(`
    <section class="page-heading">
      <span class="eyebrow dark">YOUR TABLES</span>
      <h1>大会一覧</h1>
      <p>${tournaments.length}件の大会を記録中</p>
    </section>
    <section class="card-list">${cards}</section>
    <button class="fab" data-nav="new">${icon("plus")} 新しい大会</button>
  `, {
    action: `<button class="icon-button" data-nav="new" aria-label="大会を作成">${icon("plus")}</button>`,
  });
}

function ruleFields(rules) {
  return `
    <div class="form-grid two">
      <label><span>持ち点合計</span><div class="input-suffix"><input name="totalPoints" type="number" step="100" value="${rules.totalPoints}" required><i>点</i></div></label>
      <label><span>返し点（1人）</span><div class="input-suffix"><input name="returnPoints" type="number" step="100" value="${rules.returnPoints}" required><i>点</i></div></label>
      <label><span>1pt換算</span><div class="input-suffix"><input name="pointsPerPt" type="number" step="100" value="${rules.pointsPerPt}" required><i>点</i></div></label>
    </div>
    <div class="rank-rule-grid">
      ${rules.rankPoints.map((value, index) => `<label><span>${index + 1}着</span><input name="rank${index}" type="number" step="0.1" value="${value}" required></label>`).join("")}
    </div>
    <div id="rule-summary" class="rule-summary"></div>`;
}

function renderTournamentForm(editing = false) {
  const tournament = editing ? getTournament() : null;
  const rules = tournament?.rules || { ...DEFAULT_RULES, rankPoints: [...DEFAULT_RULES.rankPoints] };
  shell(`
    <form id="tournament-form" class="stack">
      <section class="page-heading compact">
        <span class="eyebrow dark">${editing ? "SETTINGS" : "NEW TABLE"}</span>
        <h1>${editing ? "大会の設定" : "新しい大会"}</h1>
        <p>${editing ? "名前と計算ルールを変更できます" : "まずは卓を囲む4人を登録しましょう"}</p>
      </section>
      <section class="form-card">
        <h2><span>1</span> 大会名</h2>
        <label class="field"><span>名前</span><input name="name" type="text" maxlength="40" placeholder="例：金曜夜の定例会" value="${escapeHtml(tournament?.name || "")}" required></label>
      </section>
      <section class="form-card">
        <h2><span>2</span> プレイヤー</h2>
        <div class="player-form-grid">
          ${Array.from({ length: 4 }, (_, index) => `<label><b style="--player:${COLORS[index]}">${index + 1}</b><input name="player${index}" type="text" maxlength="20" placeholder="プレイヤー${index + 1}" value="${escapeHtml(tournament?.players[index]?.name || "")}" required></label>`).join("")}
        </div>
        <p class="hint">同点の場合は同着とし、該当する順位点を平均して付与します。</p>
      </section>
      <section class="form-card">
        <h2><span>3</span> 計算ルール</h2>
        ${ruleFields(rules)}
      </section>
      <div id="form-error" class="error-box" hidden></div>
      <button class="primary-button" type="submit">${icon("save")} ${editing ? "変更を保存" : "大会を作成"}</button>
      ${editing ? `<button class="danger-button" type="button" data-action="delete-tournament">${icon("trash")} 大会を削除</button>` : ""}
    </form>
  `, { title: editing ? "大会設定" : "大会作成", back: true });
  bindRulePreview();
}

function renderTournament() {
  const tournament = getTournament();
  if (!tournament) return navigate("home");
  const standings = getStandings(tournament);
  const playerStats = getPlayerStats(tournament);
  const podium = standings
    .map(
      (player, index) => `
      <div class="standing-row">
        <span class="rank-badge rank-${index + 1}">${index + 1}</span>
        <span class="player-dot" style="--player:${COLORS[player.index]}"></span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${player.wins}勝</small>
        <b class="${player.total >= 0 ? "positive" : "negative"}">${formatPt(player.total)} <i>pt</i></b>
      </div>`,
    )
    .join("");
  const history = [...tournament.games]
    .reverse()
    .map((game, reverseIndex) => {
      const gameNumber = tournament.games.length - reverseIndex;
      const winners = game.results.filter((result) => result.rank === 1);
      const winnerNames = winners
        .map((winner) => tournament.players[winner.index].name)
        .join("・");
      return `
        <button class="history-row" data-nav="game/${tournament.id}/${game.id}">
          <span class="history-number">${gameNumber}</span>
          <span><strong>第${gameNumber}半荘</strong><small>${formatDate(game.playedAt, true)}</small></span>
          <span><small>${winners.length > 1 ? "1着タイ" : "1着"}</small><strong>${escapeHtml(winnerNames)}</strong></span>
          <b class="positive">${formatPt(winners[0].finalPt)}</b>
          ${icon("chevron")}
        </button>`;
    })
    .join("");
  shell(`
    <section class="tournament-heading">
      <span class="eyebrow dark">${formatDate(tournament.createdAt)} START</span>
      <h1>${escapeHtml(tournament.name)}</h1>
      <p>${tournament.games.length}半荘 · ${tournament.players.map((p) => escapeHtml(p.name)).join(" / ")}</p>
    </section>
    <section class="dashboard-grid">
      <div class="panel standings">
        <div class="section-title"><div><span class="eyebrow dark">STANDINGS</span><h2>累計順位</h2></div></div>
        ${podium}
      </div>
      <div class="panel chart-panel">
        <div class="section-title"><div><span class="eyebrow dark">PROGRESS</span><h2>累計ポイント推移</h2></div></div>
        ${renderChart(tournament)}
      </div>
    </section>
    <section class="panel analytics-panel">
      <div class="section-title">
        <div><span class="eyebrow dark">PLAYER ANALYTICS</span><h2>プレイヤー分析</h2></div>
        <span class="analysis-caption">${tournament.games.length}半荘の集計</span>
      </div>
      <div class="analytics-grid">
        ${playerStats.map((stats) => `
          <article class="player-analytics">
            <header>
              <span class="player-dot" style="--player:${COLORS[stats.index]}"></span>
              <strong>${escapeHtml(stats.name)}</strong>
              <span>${stats.gameCount}半荘</span>
            </header>
            <div class="analytics-summary">
              <div><span>累計pt</span><strong class="${stats.totalPt >= 0 ? "positive" : "negative"}">${formatPt(stats.totalPt)}</strong></div>
              <div><span>平均pt</span><strong class="${stats.averagePt >= 0 ? "positive" : "negative"}">${formatPt(stats.averagePt)}</strong></div>
              <div><span>平均順位</span><strong>${stats.gameCount ? stats.averageRank.toFixed(1) : "—"}<small>${stats.gameCount ? "位" : ""}</small></strong></div>
            </div>
            <div class="rank-rates">
              ${stats.rankRates.map((rate, rankIndex) => `
                <div>
                  <span><b>${rankIndex + 1}着率</b><strong>${rate.toFixed(1)}%</strong></span>
                  <i><em style="width:${rate}%;--rank-color:${rankIndex === 0 ? COLORS[0] : rankIndex === 1 ? "#9aa5a2" : rankIndex === 2 ? "#d69262" : "#8b9693"}"></em></i>
                </div>`).join("")}
            </div>
          </article>`).join("")}
      </div>
    </section>
    <section class="panel history-panel">
      <div class="section-title">
        <div><span class="eyebrow dark">HISTORY</span><h2>対局履歴</h2></div>
        <button class="text-button" data-nav="new-game/${tournament.id}">${icon("plus")} 追加</button>
      </div>
      ${history || `<div class="empty-mini"><div>東</div><h3>まだ対局がありません</h3><p>最初の半荘を記録してみましょう。</p></div>`}
    </section>
    <button class="fab" data-nav="new-game/${tournament.id}">${icon("plus")} 半荘を記録</button>
  `, {
    title: tournament.name,
    back: true,
    action: `<button class="icon-button" data-nav="settings/${tournament.id}" aria-label="大会設定">${icon("edit")}</button>`,
  });
}

function renderChart(tournament) {
  if (!tournament.games.length) {
    return `<div class="chart-empty">半荘を記録すると、ここに推移が表示されます。</div>`;
  }
  const series = getSeries(tournament);
  const allValues = series.flatMap((item) => item.values);
  let min = Math.min(...allValues, 0);
  let max = Math.max(...allValues, 0);
  if (min === max) { min -= 10; max += 10; }
  const pad = Math.max((max - min) * 0.12, 5);
  min -= pad;
  max += pad;
  const width = 620, height = 260, left = 40, right = 16, top = 18, bottom = 32;
  const x = (index) => left + (index / tournament.games.length) * (width - left - right);
  const y = (value) => top + ((max - value) / (max - min)) * (height - top - bottom);
  const zeroY = y(0);
  const lines = series.map((item) => {
    const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
    const circles = item.values
      .map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${index === item.values.length - 1 ? 4.5 : 2.5}"/>`)
      .join("");
    return `<g style="--line:${COLORS[item.index]}"><polyline points="${points}"/>${circles}</g>`;
  }).join("");
  return `
    <div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="累計ポイント推移">
        <line class="zero-line" x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}"/>
        <text x="4" y="${zeroY + 4}">0</text>
        ${Array.from({ length: tournament.games.length + 1 }, (_, index) => `<text class="x-label" x="${x(index)}" y="${height - 8}">${index === 0 ? "開始" : index}</text>`).join("")}
        ${lines}
      </svg>
      <div class="chart-legend">${series.map((item) => `<span><i style="--player:${COLORS[item.index]}"></i>${escapeHtml(item.name)}</span>`).join("")}</div>
    </div>`;
}

function renderGameForm() {
  const tournament = getTournament();
  if (!tournament) return navigate("home");
  const editing = route.itemId ? tournament.games.find((game) => game.id === route.itemId) : null;
  const scores = editing?.scores || ["", "", "", ""];
  const dateValue = editing
    ? new Date(editing.playedAt).toISOString().slice(0, 16)
    : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  shell(`
    <form id="game-form" class="stack">
      <section class="page-heading compact">
        <span class="eyebrow dark">${editing ? "EDIT GAME" : `GAME ${tournament.games.length + 1}`}</span>
        <h1>${editing ? "半荘を編集" : "半荘を記録"}</h1>
        <p>最終持ち点を入力してください</p>
      </section>
      <section class="score-entry panel">
        <label class="date-field"><span>対局日時</span><input name="playedAt" type="datetime-local" value="${dateValue}" required></label>
        <div class="score-inputs">
          ${tournament.players.map((player, index) => `
            <label>
              <span class="player-index" style="--player:${COLORS[index]}">${index + 1}</span>
              <strong>${escapeHtml(player.name)}</strong>
              <div class="input-suffix"><input name="score${index}" type="number" inputmode="numeric" step="100" placeholder="0" value="${scores[index]}" required><i>点</i></div>
            </label>`).join("")}
        </div>
      </section>
      <section id="live-result" class="panel live-result"></section>
      <button id="save-game" class="primary-button" type="submit" disabled>${icon("save")} ${editing ? "変更を保存" : "この結果を保存"}</button>
    </form>
  `, { title: editing ? "半荘を編集" : "半荘入力", back: true });
  updateLiveResult();
}

function updateLiveResult() {
  const form = document.querySelector("#game-form");
  if (!form) return;
  const tournament = getTournament();
  const scores = Array.from({ length: 4 }, (_, i) => form.elements[`score${i}`].value);
  const calculation = calculateGame(scores, tournament.rules);
  const target = document.querySelector("#live-result");
  const saveButton = document.querySelector("#save-game");
  if (!calculation.complete) {
    target.innerHTML = `<div class="live-placeholder"><span>計</span><p>4人の点数を入力すると<br>順位とポイントを表示します</p></div>`;
    saveButton.disabled = true;
    return;
  }
  const sorted = [...calculation.results].sort((a, b) => a.rank - b.rank);
  target.innerHTML = `
    <div class="total-check ${calculation.valid ? "valid" : "invalid"}">
      <span>${calculation.valid ? "✓ 合計点 OK" : "入力を確認してください"}</span>
      <strong>${formatScore(calculation.scoreTotal)}</strong>
      ${calculation.difference !== 0 ? `<small>規定より${calculation.difference > 0 ? "+" : ""}${calculation.difference.toLocaleString()}点</small>` : ""}
      ${!calculation.multiplesOf100 ? `<small>点数は100点単位で入力してください</small>` : ""}
    </div>
    <div class="preview-table">
      ${sorted.map((result) => `
        <div>
          <span class="rank-badge rank-${result.rank}">${result.rank}${result.tied ? "同" : ""}</span>
          <strong>${escapeHtml(tournament.players[result.index].name)}</strong>
          <span>${formatScore(result.score)}</span>
          <small>素点 ${formatPt(result.basePt)}</small>
          <small>順位点 ${formatPt(result.rankPt)}</small>
          <b class="${result.finalPt >= 0 ? "positive" : "negative"}">${formatPt(result.finalPt)} <i>pt</i></b>
        </div>`).join("")}
    </div>
    <div class="final-check">最終pt合計 <strong>${formatPt(calculation.finalTotal, false)} pt</strong></div>`;
  saveButton.disabled = !calculation.valid;
}

function renderGameDetail() {
  const tournament = getTournament();
  const game = tournament?.games.find((item) => item.id === route.itemId);
  if (!tournament || !game) return navigate("home");
  const gameNumber = tournament.games.findIndex((item) => item.id === game.id) + 1;
  const sorted = [...game.results].sort((a, b) => a.rank - b.rank);
  shell(`
    <section class="result-hero">
      <span class="eyebrow">GAME RESULT</span>
      <h1>第${gameNumber}半荘</h1>
      <p>${formatDate(game.playedAt, true)}</p>
    </section>
    <section class="result-list">
      ${sorted.map((result) => `
        <article class="result-card rank-card-${result.rank}">
          <div class="result-rank"><strong>${result.rank}</strong><span>${result.tied ? "着タイ" : "着"}</span></div>
          <div class="result-player"><span class="player-dot" style="--player:${COLORS[result.index]}"></span><h2>${escapeHtml(tournament.players[result.index].name)}</h2><p>${formatScore(result.score)}</p></div>
          <div class="result-calc"><span>素点 ${formatPt(result.basePt)}</span><span>順位点 ${formatPt(result.rankPt)}</span></div>
          <div class="result-total ${result.finalPt >= 0 ? "positive" : "negative"}">${formatPt(result.finalPt)}<small>pt</small></div>
        </article>`).join("")}
    </section>
    <div class="result-actions">
      <button class="secondary-button" data-nav="edit-game/${tournament.id}/${game.id}">${icon("edit")} 編集</button>
      <button class="danger-button compact" data-action="delete-game">${icon("trash")} 削除</button>
    </div>
  `, { title: `第${gameNumber}半荘`, back: true });
}

function bindRulePreview() {
  const form = document.querySelector("#tournament-form");
  if (!form) return;
  const update = () => {
    const rules = readRules(form);
    const errors = validateRules(rules);
    const baseTotal = (rules.totalPoints - rules.returnPoints * 4) / rules.pointsPerPt;
    const rankTotal = rules.rankPoints.reduce((sum, value) => sum + value, 0);
    document.querySelector("#rule-summary").innerHTML = `
      <div><span>素点合計</span><strong>${formatPt(baseTotal, false)} pt</strong></div>
      <div><span>順位点合計</span><strong>${formatPt(rankTotal)} pt</strong></div>
      <div class="${errors.length ? "invalid-text" : "valid-text"}"><span>最終pt合計</span><strong>${formatPt(baseTotal + rankTotal, false)} pt</strong></div>`;
  };
  form.addEventListener("input", update);
  update();
}

function readRules(form) {
  return {
    totalPoints: Number(form.elements.totalPoints.value),
    returnPoints: Number(form.elements.returnPoints.value),
    pointsPerPt: Number(form.elements.pointsPerPt.value),
    rankPoints: Array.from({ length: 4 }, (_, i) => Number(form.elements[`rank${i}`].value)),
  };
}

function handleTournamentSubmit(form) {
  const rules = readRules(form);
  const errors = validateRules(rules);
  const name = form.elements.name.value.trim();
  const players = Array.from({ length: 4 }, (_, index) => form.elements[`player${index}`].value.trim());
  const existing = getTournament();
  if (!name) errors.unshift("大会名を入力してください");
  if (players.some((player) => !player)) errors.unshift("4人の名前を入力してください");
  if (new Set(players).size !== 4) errors.unshift("プレイヤー名は重複しないようにしてください");
  if (
    route.page === "settings" &&
    existing?.games.some((game) => !calculateGame(game.scores, rules).valid)
  ) {
    errors.push("保存済みの半荘と両立しないルールには変更できません");
  }
  const errorBox = document.querySelector("#form-error");
  if (errors.length) {
    errorBox.hidden = false;
    errorBox.innerHTML = errors.map((error) => `<p>${escapeHtml(error)}</p>`).join("");
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const now = new Date().toISOString();
  if (route.page === "settings" && existing) {
    existing.name = name;
    existing.players = players.map((player, index) => ({ id: existing.players[index]?.id || id(), name: player }));
    existing.rules = rules;
    existing.updatedAt = now;
    existing.games = existing.games.map((game) => ({
      ...game,
      results: calculateGame(game.scores, rules).results,
    }));
    saveState();
    notify("大会設定を更新しました");
    navigate(`tournament/${existing.id}`);
  } else {
    const tournament = {
      id: id(),
      name,
      createdAt: now,
      updatedAt: now,
      rules,
      players: players.map((player) => ({ id: id(), name: player })),
      games: [],
    };
    state.tournaments.push(tournament);
    saveState();
    notify("大会を作成しました");
    navigate(`tournament/${tournament.id}`);
  }
}

function handleGameSubmit(form) {
  const tournament = getTournament();
  const scores = Array.from({ length: 4 }, (_, index) => Number(form.elements[`score${index}`].value));
  const calculation = calculateGame(scores, tournament.rules);
  if (!calculation.valid) return notify("点数を確認してください");
  const now = new Date().toISOString();
  const game = {
    id: route.itemId || id(),
    playedAt: new Date(form.elements.playedAt.value).toISOString(),
    createdAt: now,
    scores,
    results: calculation.results,
  };
  const existingIndex = tournament.games.findIndex((item) => item.id === route.itemId);
  if (existingIndex >= 0) tournament.games[existingIndex] = { ...tournament.games[existingIndex], ...game };
  else tournament.games.push(game);
  tournament.games.sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));
  tournament.updatedAt = now;
  saveState();
  notify(existingIndex >= 0 ? "結果を更新しました" : "半荘を記録しました");
  navigate(`tournament/${tournament.id}`);
}

function confirmDelete(message) {
  return window.confirm(message);
}

function render() {
  route = parseRoute();
  window.scrollTo(0, 0);
  if (route.page === "home") renderHome();
  else if (route.page === "new") renderTournamentForm(false);
  else if (route.page === "settings") renderTournamentForm(true);
  else if (route.page === "tournament") renderTournament();
  else if (route.page === "new-game" || route.page === "edit-game") renderGameForm();
  else if (route.page === "game") renderGameDetail();
  else navigate("home");
}

app.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) return navigate(nav.dataset.nav);
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "back") history.length > 1 ? history.back() : navigate("home");
  if (action === "delete-game") {
    const tournament = getTournament();
    if (!confirmDelete("この半荘の記録を削除しますか？")) return;
    tournament.games = tournament.games.filter((game) => game.id !== route.itemId);
    tournament.updatedAt = new Date().toISOString();
    saveState();
    notify("半荘を削除しました");
    navigate(`tournament/${tournament.id}`);
  }
  if (action === "delete-tournament") {
    const tournament = getTournament();
    if (!confirmDelete(`「${tournament.name}」とすべての対局記録を削除しますか？`)) return;
    state.tournaments = state.tournaments.filter((item) => item.id !== tournament.id);
    saveState();
    notify("大会を削除しました");
    navigate("home");
  }
});

app.addEventListener("input", (event) => {
  if (event.target.closest("#game-form")) updateLiveResult();
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "tournament-form") handleTournamentSubmit(event.target);
  if (event.target.id === "game-form") handleGameSubmit(event.target);
});

window.addEventListener("hashchange", render);
window.addEventListener("storage", () => {
  state = loadState();
  render();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

render();
