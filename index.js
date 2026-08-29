"use strict";

const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

// nothing you collect: keys are loot, the locks they open are not
const NOT_LOOT = [
  "↑",
  "↓",
  "⇧",
  "⇩",
  "Lock",
  "Lock-free",
  "Unknown",
  "Start",
  "Takes time"
];

// you land on the arrow up coming from the depth above, you never walk onto it
const ENTRY_TILES = ["↑", "⇧"];

// those cells carry a bare icon to keep the grid readable, the table still needs the word
const ICON_NAMES = {
  "🔥": "Fire Stones",
  "💎": "Diamonds"
};

const EMPTY_CELL = {
  text: "",
  textColor: "#ffffff",
  bgColor: "#34363c"
};

const state = {
  depths: [],
  activeDepthId: null,
  summaryScope: "depth"
};

const els = {};

function cache() {
  [
    "depthList",
    "depthTitle",
    "tileCount",
    "prevDepthBtn",
    "nextDepthBtn",
    "depthSelect",
    "loadError",
    "grid",
    "summary",
    "summaryTable",
    "summaryBody",
    "summaryNote",
    "summaryEmpty",
    "scopeDepthBtn",
    "scopeAllBtn"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function normalizeCell(cell) {
  return {
    text: String(cell?.text || "").slice(0, 32),
    textColor: cell?.textColor || "#ffffff",
    bgColor: cell?.bgColor || EMPTY_CELL.bgColor
  };
}

function normalizeDepth(depth, index) {
  return {
    id: depth?.id || `depth-${index + 1}`,
    name: String(depth?.name || `Depth ${index + 1}`),
    cells:
      Array.isArray(depth?.cells) && depth.cells.length === CELL_COUNT
        ? depth.cells.map(normalizeCell)
        : Array.from({ length: CELL_COUNT }, () => ({ ...EMPTY_CELL }))
  };
}

async function loadDepths() {
  try {
    const response = await fetch("depths.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`depths.json: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (
      !data ||
      Number(data.gridSize) !== GRID_SIZE ||
      !Array.isArray(data.depths) ||
      data.depths.length === 0
    ) {
      throw new Error("depths.json is not a valid depths file");
    }

    state.depths = data.depths.map(normalizeDepth);

    const requestedDepth = new URLSearchParams(window.location.search).get("depth");
    const requested = requestedDepth
      ? state.depths.find(
          (depth) =>
            depth.id === requestedDepth ||
            depth.name.toLowerCase() === requestedDepth.toLowerCase()
        )
      : null;

    state.activeDepthId = requested?.id || state.depths[0].id;

    renderAll();
  } catch (error) {
    console.error(error);
    els.depthTitle.textContent = "Unable to load depths";
    els.loadError.hidden = false;
    els.loadError.textContent = "Could not load depths.json.";
    renderGrid();
  }
}

function activeDepth() {
  return state.depths.find((depth) => depth.id === state.activeDepthId) || null;
}

function buildGrid() {
  els.grid.innerHTML = "";

  for (let i = 0; i < CELL_COUNT; i += 1) {
    const cell = document.createElement("div");
    cell.className = "depth-cell readonly-cell";
    cell.dataset.index = i;
    els.grid.appendChild(cell);
  }
}

function countTiles(cells) {
  return cells.filter((cell) => {
    const text = cell.text.trim();
    return text && !ENTRY_TILES.includes(text);
  }).length;
}

function renderTileCount() {
  const depth = activeDepth();
  const total = depth ? countTiles(depth.cells) : 0;

  els.tileCount.hidden = !depth;
  els.tileCount.textContent = `${total} ${total === 1 ? "tile" : "tiles"}`;
}

function renderGrid() {
  const depth = activeDepth();
  const cells = [...els.grid.querySelectorAll(".depth-cell")];

  renderTileCount();

  const depthCells = depth?.cells || Array.from({ length: CELL_COUNT }, () => EMPTY_CELL);

  depthCells.forEach((cell, index) => {
    const el = cells[index];
    if (!el) return;

    el.textContent = cell.text || "";
    el.style.backgroundColor = cell.bgColor || EMPTY_CELL.bgColor;
    el.style.color = cell.textColor || EMPTY_CELL.textColor;
    el.classList.toggle("active-cell", Boolean(cell.text));

    const row = Math.floor(index / GRID_SIZE) + 1;
    const column = String.fromCharCode(65 + (index % GRID_SIZE));
    el.title = cell.text ? `${column}${row}: ${cell.text}` : `${column}${row}`;

    if (["↑", "↓", "⇩", "⇧"].includes(cell.text)) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = cell.text;
      el.replaceChildren(arrow);
    }
  });
}

function renderDepthList() {
  els.depthList.innerHTML = "";

  state.depths.forEach((depth) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "depth-item";
    button.textContent = depth.name;
    button.classList.toggle("active", depth.id === state.activeDepthId);

    button.addEventListener("click", () => selectDepth(depth.id));
    els.depthList.appendChild(button);
  });
}

function selectDepth(depthId) {
  if (!state.depths.some((depth) => depth.id === depthId)) return;

  state.activeDepthId = depthId;
  const depth = activeDepth();

  const url = new URL(window.location.href);
  url.searchParams.set("depth", depth.id);
  window.history.replaceState(null, "", url);

  renderAll();
}

function navigate(direction) {
  const index = state.depths.findIndex((depth) => depth.id === state.activeDepthId);
  const target = state.depths[index + direction];

  if (target) selectDepth(target.id);
}

function renderHeaderAndNav() {
  const depth = activeDepth();

  els.depthTitle.textContent = depth?.name || "Depth";

  els.depthSelect.innerHTML = "";

  state.depths.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    els.depthSelect.appendChild(option);
  });

  els.depthSelect.value = state.activeDepthId;

  const index = state.depths.findIndex((item) => item.id === state.activeDepthId);
  els.prevDepthBtn.disabled = index <= 0;
  els.nextDepthBtn.disabled = index < 0 || index >= state.depths.length - 1;
}

function summarize(cells) {
  const totals = new Map();

  cells.forEach((cell) => {
    const text = cell.text.trim();
    if (!text) return;

    const counted = text.match(/^(\d+)(?: (\S+))?(?:\n(.+))?$/);
    const label = counted
      ? [counted[2], counted[3] || ICON_NAMES[counted[2]]].filter(Boolean).join(" ")
      : text.replace("\n", " ").trim();

    if (!label) return;

    if (NOT_LOOT.some((marker) => label.endsWith(marker))) return;

    totals.set(label, (totals.get(label) || 0) + (counted ? Number(counted[1]) : 1));
  });

  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function setSummaryScope(scope) {
  state.summaryScope = scope;
  renderSummary();
}

function renderSummary() {
  const showAll = state.summaryScope === "all";
  const cells = showAll
    ? state.depths.flatMap((depth) => depth.cells)
    : activeDepth()?.cells || [];

  const rows = summarize(cells);

  els.summary.hidden = state.depths.length === 0;
  els.scopeDepthBtn.classList.toggle("active", !showAll);
  els.scopeAllBtn.classList.toggle("active", showAll);

  els.summaryTable.hidden = rows.length === 0;
  els.summaryEmpty.hidden = rows.length > 0;
  els.summaryNote.hidden = !rows.some(([label]) => label === "Event Bundle");
  els.summaryBody.innerHTML = "";

  rows.forEach(([label, total]) => {
    const row = document.createElement("tr");

    const count = document.createElement("td");
    count.textContent = total;

    const name = document.createElement("td");
    name.textContent = label;

    row.append(count, name);
    els.summaryBody.appendChild(row);
  });
}

function renderAll() {
  renderDepthList();
  renderHeaderAndNav();
  renderGrid();
  renderSummary();
}

function bind() {
  els.prevDepthBtn.addEventListener("click", () => navigate(-1));
  els.nextDepthBtn.addEventListener("click", () => navigate(1));
  els.depthSelect.addEventListener("change", () => selectDepth(els.depthSelect.value));
  els.scopeDepthBtn.addEventListener("click", () => setSummaryScope("depth"));
  els.scopeAllBtn.addEventListener("click", () => setSummaryScope("all"));
}

function init() {
  cache();
  buildGrid();
  bind();
  loadDepths();
}

document.addEventListener("DOMContentLoaded", init);
