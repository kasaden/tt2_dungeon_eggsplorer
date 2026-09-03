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

// the ❓ tile is drawn as a carved stone block, the way the game shows it
const UNKNOWN_TILE = "❓\nUnknown";
// Lock-free and Takes time are one gate in two states, shut and shut behind bars
const LOCK_FREE_TILE = "🔓\nLock-free";
const TAKES_TIME_TILE = "⏳\nTakes time";
// "9 🔥" and "5 💎" are drawn: the icon fills the tile, the count sits across its foot
const ICON_TILE = /^(\d+) (🔥|💎)$/u;

// those cells carry a bare icon to keep the grid readable, the table still needs the word
const ICON_NAMES = {
  "🔥": "Fire Stones",
  "💎": "Diamonds"
};

// the Overview is a view of its own, ahead of Depth 1 in the navigation
const OVERVIEW_ID = "overview";

const EMPTY_CELL = {
  text: "",
  textColor: "#ffffff",
  bgColor: "#34363c"
};

const state = {
  depths: [],
  activeDepthId: null,
  summaryScope: "depth",
  // every item of the dungeon, read once at load
  loot: [],
  openLoot: new Set(),
  target: null
};

const els = {};

let targetTimer;

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
    "scopeAllBtn",
    "viewEyebrow",
    "workspace",
    "overview",
    "overviewStats",
    "lootList"
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

// "5 🔥" is 5 Fire Stones, "3\nSkill Points" is 3 Skill Points, "Event Bundle" is one of them.
// Every total on the site comes through here, nothing else reads a cell.
function tileParts(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const counted = trimmed.match(/^(\d+)(?: (\S+))?(?:\n(.+))?$/);
  const label = counted
    ? [counted[2], counted[3] || ICON_NAMES[counted[2]]].filter(Boolean).join(" ")
    : trimmed.replace("\n", " ").trim();

  if (!label) return null;

  return { label, quantity: counted ? Number(counted[1]) : 1 };
}

function isLoot(label) {
  return !NOT_LOOT.some((marker) => label.endsWith(marker));
}

function coordOf(index) {
  const column = String.fromCharCode(65 + (index % GRID_SIZE));
  const row = Math.floor(index / GRID_SIZE) + 1;
  return `${column}${row}`;
}

function indexOfCoord(coord) {
  const match = coord?.trim().toUpperCase().match(/^([A-I])([1-9])$/);
  if (!match) return null;

  return (Number(match[2]) - 1) * GRID_SIZE + (match[1].charCodeAt(0) - 65);
}

// total is how much you collect, tileCount how many tiles you walk on: not the same number
function collectLoot(depths) {
  const found = new Map();

  depths.forEach((depth) => {
    depth.cells.forEach((cell, cellIndex) => {
      const parts = tileParts(cell.text);
      if (!parts || !isLoot(parts.label)) return;

      let entry = found.get(parts.label);

      if (!entry) {
        entry = { label: parts.label, total: 0, tileCount: 0, locations: [] };
        found.set(parts.label, entry);
      }

      entry.total += parts.quantity;
      entry.tileCount += 1;
      entry.locations.push({
        depthId: depth.id,
        depthName: depth.name,
        cellIndex,
        coord: coordOf(cellIndex),
        quantity: parts.quantity
      });
    });
  });

  return [...found.values()].sort(
    (a, b) => b.total - a.total || a.label.localeCompare(b.label)
  );
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
    state.loot = collectLoot(state.depths);

    const params = new URLSearchParams(window.location.search);
    const requestedDepth = params.get("depth");
    const requested = requestedDepth
      ? state.depths.find(
          (depth) =>
            depth.id === requestedDepth ||
            depth.name.toLowerCase() === requestedDepth.toLowerCase()
        )
      : null;

    // no ?depth at all lands on the Overview, an unknown one still falls back to the first depth
    if (!requestedDepth) {
      state.activeDepthId = OVERVIEW_ID;
    } else if (requested) {
      state.activeDepthId = requested.id;
    } else if (requestedDepth.toLowerCase() === OVERVIEW_ID) {
      state.activeDepthId = OVERVIEW_ID;
    } else {
      state.activeDepthId = state.depths[0].id;
    }

    const requestedCell = requested ? indexOfCoord(params.get("cell")) : null;
    if (requestedCell !== null) {
      state.target = { depthId: requested.id, cellIndex: requestedCell };
    }

    renderAll();
    if (state.target) armTarget();
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

function views() {
  return [{ id: OVERVIEW_ID, name: "Overview" }, ...state.depths];
}

function isOverview() {
  return state.activeDepthId === OVERVIEW_ID;
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
  const target = depth && state.target?.depthId === depth.id ? state.target.cellIndex : -1;

  depthCells.forEach((cell, index) => {
    const el = cells[index];
    if (!el) return;

    el.textContent = cell.text || "";
    el.style.backgroundColor = cell.bgColor || EMPTY_CELL.bgColor;
    el.style.color = cell.textColor || EMPTY_CELL.textColor;
    el.classList.toggle("active-cell", Boolean(cell.text));
    el.classList.toggle("unknown-cell", cell.text === UNKNOWN_TILE);
    el.classList.toggle("cell-target", index === target);

    const row = Math.floor(index / GRID_SIZE) + 1;
    const column = String.fromCharCode(65 + (index % GRID_SIZE));
    el.title = cell.text ? `${column}${row}: ${cell.text}` : `${column}${row}`;

    if (["↑", "↓", "⇩", "⇧"].includes(cell.text)) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = cell.text;
      el.replaceChildren(arrow);
    }

    if (cell.text === UNKNOWN_TILE) {
      const mark = document.createElement("span");
      mark.className = "unknown";
      mark.textContent = "?";
      el.replaceChildren(mark);
      // the stone comes from the stylesheet, the painted colours would cover it
      el.style.backgroundColor = "";
      el.style.color = "";
    }

    if (cell.text === LOCK_FREE_TILE || cell.text === TAKES_TIME_TILE) {
      const gate = document.createElement("span");
      gate.className = cell.text === TAKES_TIME_TILE ? "gate barred" : "gate";
      el.replaceChildren(gate);
      el.style.color = "";
    }

    const loot = cell.text.match(ICON_TILE);
    if (loot) {
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = loot[2];

      const qty = document.createElement("span");
      qty.className = "qty";
      qty.textContent = loot[1];

      el.replaceChildren(icon, qty);
      el.style.color = "";
    }
  });
}

function renderDepthList() {
  els.depthList.innerHTML = "";

  views().forEach((view) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "depth-item";
    button.textContent = view.name;
    button.classList.toggle("active", view.id === state.activeDepthId);

    button.addEventListener("click", () => selectDepth(view.id));
    els.depthList.appendChild(button);
  });
}

function selectDepth(depthId, targetCell = null) {
  if (!views().some((view) => view.id === depthId)) return;

  clearTarget();
  if (targetCell !== null) state.target = { depthId, cellIndex: targetCell };

  state.activeDepthId = depthId;

  const url = new URL(window.location.href);
  url.searchParams.set("depth", depthId);

  if (state.target) {
    url.searchParams.set("cell", coordOf(state.target.cellIndex));
  } else {
    url.searchParams.delete("cell");
  }

  window.history.replaceState(null, "", url);

  renderAll();
}

function navigate(direction) {
  const list = views();
  const index = list.findIndex((view) => view.id === state.activeDepthId);
  const target = list[index + direction];

  if (target) selectDepth(target.id);
}

// where the Overview sends you: the depth opens on one tile, lit long enough to find it
function goToCell(depthId, cellIndex) {
  selectDepth(depthId, cellIndex);
  armTarget();
}

function armTarget() {
  if (!state.target) return;

  const cell = els.grid.querySelector(`.depth-cell[data-index="${state.target.cellIndex}"]`);
  if (cell) cell.scrollIntoView({ behavior: "smooth", block: "center" });

  targetTimer = setTimeout(() => {
    state.target = null;
    renderGrid();
  }, 6000);
}

function clearTarget() {
  clearTimeout(targetTimer);
  state.target = null;
}

function renderHeaderAndNav() {
  const list = views();
  const view = list.find((item) => item.id === state.activeDepthId);

  els.depthTitle.textContent = view?.name || "Depth";
  els.viewEyebrow.textContent = isOverview() ? "Whole dungeon" : "Current depth";

  els.depthSelect.innerHTML = "";

  list.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    els.depthSelect.appendChild(option);
  });

  els.depthSelect.value = state.activeDepthId;

  const index = list.findIndex((item) => item.id === state.activeDepthId);
  els.prevDepthBtn.disabled = index <= 0;
  els.nextDepthBtn.disabled = index < 0 || index >= list.length - 1;
}

function summarize(cells) {
  const totals = new Map();

  cells.forEach((cell) => {
    const parts = tileParts(cell.text);
    if (!parts || !isLoot(parts.label)) return;

    totals.set(parts.label, (totals.get(parts.label) || 0) + parts.quantity);
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

function dungeonStats() {
  let mapped = 0;
  let unknown = 0;
  let locks = 0;
  let keys = 0;

  state.depths.forEach((depth) => {
    depth.cells.forEach((cell) => {
      const text = cell.text.trim();
      if (!text || ENTRY_TILES.includes(text)) return;

      mapped += 1;
      if (text === UNKNOWN_TILE) unknown += 1;

      const parts = tileParts(text);
      if (!parts) return;

      if (parts.label.endsWith("Lock")) locks += 1;
      if (parts.label.endsWith("Key")) keys += 1;
    });
  });

  // taken off the table below, so the two can never disagree
  const rewardTiles = state.loot.reduce((sum, entry) => sum + entry.tileCount, 0);

  return [
    ["Depths", state.depths.length],
    ["Mapped tiles", mapped],
    ["Reward tiles", rewardTiles],
    ["Items", state.loot.length],
    ["Keys", keys],
    ["Locks", locks],
    ["Unknown", unknown]
  ];
}

function renderOverviewStats() {
  els.overviewStats.innerHTML = "";

  dungeonStats().forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat";

    const number = document.createElement("span");
    number.className = "stat-value";
    number.textContent = value;

    const name = document.createElement("span");
    name.className = "stat-label";
    name.textContent = label;

    card.append(number, name);
    els.overviewStats.appendChild(card);
  });
}

function buildPlaces(entry) {
  const places = document.createElement("div");
  places.className = "loot-places";

  // grouped by depth: which depth to walk reads before which tile to step on
  const groups = new Map();

  entry.locations.forEach((location) => {
    if (!groups.has(location.depthId)) {
      groups.set(location.depthId, { name: location.depthName, cells: [] });
    }

    groups.get(location.depthId).cells.push(location);
  });

  // "×1" on every tile of a key says nothing, so the amount only shows where it varies
  const showQuantity = entry.locations.some((location) => location.quantity !== 1);

  groups.forEach((group, depthId) => {
    const block = document.createElement("div");
    block.className = "place-group";

    const depthButton = document.createElement("button");
    depthButton.type = "button";
    depthButton.className = "place-depth";
    depthButton.textContent = group.name;
    depthButton.title = `Open ${group.name}`;
    depthButton.addEventListener("click", () => selectDepth(depthId));

    const cells = document.createElement("div");
    cells.className = "place-cells";

    group.cells.forEach((location) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "place";
      chip.title = `${group.name}, ${location.coord}: ${location.quantity} ${entry.label}`;

      const coord = document.createElement("span");
      coord.className = "place-coord";
      coord.textContent = location.coord;
      chip.append(coord);

      if (showQuantity) {
        const quantity = document.createElement("span");
        quantity.className = "place-qty";
        // "×5" and not "5", which would read as part of the coordinate
        quantity.textContent = `×${location.quantity}`;
        chip.append(quantity);
      }

      chip.addEventListener("click", () => goToCell(depthId, location.cellIndex));
      cells.append(chip);
    });

    block.append(depthButton, cells);
    places.append(block);
  });

  return places;
}

function toggleLoot(label) {
  if (state.openLoot.has(label)) {
    state.openLoot.delete(label);
  } else {
    state.openLoot.add(label);
  }

  renderLootList();
}

function renderLootList() {
  els.lootList.innerHTML = "";

  state.loot.forEach((entry) => {
    const open = state.openLoot.has(entry.label);

    const row = document.createElement("div");
    row.className = "loot-row";
    row.classList.toggle("open", open);

    const head = document.createElement("button");
    head.type = "button";
    head.className = "loot-head";
    head.setAttribute("aria-expanded", String(open));

    const total = document.createElement("span");
    total.className = "loot-total";
    total.textContent = entry.total;

    const name = document.createElement("span");
    name.className = "loot-name";
    name.textContent = entry.label;

    const tiles = document.createElement("span");
    tiles.className = "loot-tiles";
    tiles.textContent = `${entry.tileCount} ${entry.tileCount === 1 ? "tile" : "tiles"}`;

    const chevron = document.createElement("span");
    chevron.className = "loot-chevron";
    chevron.textContent = "▸";

    head.append(total, name, tiles, chevron);
    head.addEventListener("click", () => toggleLoot(entry.label));

    row.append(head);
    if (open) row.append(buildPlaces(entry));

    els.lootList.appendChild(row);
  });
}

function renderOverview() {
  if (!isOverview()) return;

  renderOverviewStats();
  renderLootList();
}

function renderAll() {
  renderDepthList();
  renderHeaderAndNav();
  renderGrid();
  renderSummary();
  renderOverview();

  els.workspace.hidden = isOverview();
  els.overview.hidden = !isOverview();
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
