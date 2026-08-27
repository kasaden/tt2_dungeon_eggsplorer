"use strict";

const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const EMPTY_CELL = {
  text: "",
  textColor: "#ffffff",
  bgColor: "#34363c"
};

const state = {
  depths: [],
  activeDepthId: null
};

const els = {};

function cache() {
  [
    "depthList",
    "depthTitle",
    "prevDepthBtn",
    "nextDepthBtn",
    "loadError",
    "grid"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function normalizeCell(cell) {
  return {
    text: String(cell?.text || "").slice(0, 18),
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

function renderGrid() {
  const depth = activeDepth();
  const cells = [...els.grid.querySelectorAll(".depth-cell")];

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

  const index = state.depths.findIndex((item) => item.id === state.activeDepthId);
  els.prevDepthBtn.disabled = index <= 0;
  els.nextDepthBtn.disabled = index < 0 || index >= state.depths.length - 1;
}

function renderAll() {
  renderDepthList();
  renderHeaderAndNav();
  renderGrid();
}

function bind() {
  els.prevDepthBtn.addEventListener("click", () => navigate(-1));
  els.nextDepthBtn.addEventListener("click", () => navigate(1));
}

function init() {
  cache();
  buildGrid();
  bind();
  loadDepths();
}

document.addEventListener("DOMContentLoaded", init);
