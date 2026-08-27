"use strict";

const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const DEPTHS_ENDPOINT = "api/depths";

const EMPTY_CELL = {
  text: "",
  textColor: "#ffffff",
  bgColor: "#34363c"
};

const ITEMS = [
  { id: "up", name: "↑UP↑", symbol: "↑", short: "↑", color: "#ffffff", bg: "#59627f", quantity: false },
  { id: "down", name: "↓DOWN↓", symbol: "↓", short: "↓", color: "#ffffff", bg: "#59627f", quantity: false },
  { id: "other", name: "Other", symbol: "Aa", short: "", color: "#ffffff", bg: "#59627f", other: true },

  { id: "fire_stones", name: "Fire Stones", symbol: "FS", short: "FS", color: "#f0a22e", bg: "#59627f" },
  { id: "diamonds", name: "Diamonds", symbol: "Dia", short: "dias", color: "#54d7ef", bg: "#59627f" },
  { id: "crafting_shards", name: "Crafting Shards", symbol: "CS", short: "Shards", color: "#dca84b", bg: "#59627f" },
  { id: "pet_eggs", name: "Pet Eggs", symbol: "Egg", short: "Eggs", color: "#9dd49d", bg: "#59627f" },
  { id: "skill_points", name: "Skill Points", symbol: "SP", short: "SP", color: "#e5c95b", bg: "#59627f" },
  { id: "perk_tickets", name: "Perk Tickets", symbol: "PT", short: "Tickets", color: "#e996a9", bg: "#59627f" },
  { id: "fortune_hero_weapon", name: "Fortune Hero Weapon", symbol: "FHW", short: "FHW", color: "#92bfe5", bg: "#59627f", quantity: false },
  { id: "fortune_hero_scroll", name: "Fortune Hero Scroll", symbol: "FHS", short: "FHS", color: "#b9a0dc", bg: "#59627f", quantity: false },

  { id: "normal_equipment", name: "Normal Equipment drops", symbol: "Eq", short: "Normal Eq", color: "#ffffff", bg: "#59627f", quantity: false },
  { id: "event_equipment", name: "Event Equipment drops", symbol: "Eq", short: "Event Eq", color: "#e3949f", bg: "#59627f", quantity: false },
  { id: "rare_equipment", name: "Rare Equipment drops", symbol: "Eq", short: "Rare Eq", color: "#80aee0", bg: "#59627f", quantity: false },
  { id: "legendary_equipment", name: "Legendary Equipment drops", symbol: "Eq", short: "Leg Eq", color: "#dba34b", bg: "#59627f", quantity: false },
  { id: "mythic_equipment", name: "Mythic Equipment Drop", symbol: "Eq", short: "Myth Eq", color: "#b891d4", bg: "#59627f", quantity: false },
  { id: "unique_equipment", name: "Unique Equipment Drop", symbol: "Eq", short: "Unique Eq", color: "#76cbc2", bg: "#59627f", quantity: false },

  { id: "event_cosmetics", name: "Event Cosmetics", symbol: "EC", short: "Cosmetics", color: "#df96c1", bg: "#59627f" },
  { id: "raid_wild_cards", name: "Raid Wild Cards", symbol: "RWC", short: "RWC", color: "#ca91da", bg: "#59627f" },

  { id: "silver_keys", name: "Silver Keys", symbol: "SK", short: "🔑\nSilver Key", color: "#d6d6d7", bg: "#59627f", quantity: false },
  { id: "silver_locks", name: "Silver Locks", symbol: "SL", short: "🔒\nSilver Lock", color: "#d6d6d7", bg: "#59627f", quantity: false },
  { id: "gold_keys", name: "Gold Keys", symbol: "GK", short: "🔑\nGold Key", color: "#dfb654", bg: "#59627f", quantity: false },
  { id: "gold_locks", name: "Gold Locks", symbol: "GL", short: "🔒\nGold Lock", color: "#dfb654", bg: "#59627f", quantity: false },
  { id: "special_keys", name: "Special Keys", symbol: "SpK", short: "🔑\n{name}", suffix: "Key", color: "#b69bd5", bg: "#59627f", quantity: false, special: true },
  { id: "special_locks", name: "Special Locks", symbol: "SpL", short: "🔒\n{name}", suffix: "Lock", color: "#b69bd5", bg: "#59627f", quantity: false, special: true },
  { id: "lock_free_tiles", name: "Lock-free Tiles", symbol: "LF", short: "🔓\nLock-free", color: "#a3d2af", bg: "#59627f", quantity: false },

  { id: "erase", name: "Erase", symbol: "×", short: "", color: "#b8b8b8", bg: "#34363c", quantity: false, erase: true }
];

const state = {
  depths: [],
  activeDepthId: null,
  selectedItemId: "fire_stones",
  quantities: Object.fromEntries(
    ITEMS
      .filter((item) => item.quantity !== false && !item.other && !item.erase)
      .map((item) => [item.id, 1])
  ),
  otherText: "Other",
  otherColor: "#ffffff",
  specialText: Object.fromEntries(
    ITEMS.filter((item) => item.special).map((item) => [item.id, ""])
  ),
  pointerDown: false,
  dragTouched: new Set()
};

const els = {};

function uid() {
  return `depth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEmptyCells() {
  return Array.from({ length: CELL_COUNT }, () => ({ ...EMPTY_CELL }));
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
    id: depth?.id || uid(),
    name: String(depth?.name || `Depth ${index + 1}`),
    cells:
      Array.isArray(depth?.cells) && depth.cells.length === CELL_COUNT
        ? depth.cells.map(normalizeCell)
        : makeEmptyCells()
  };
}

async function fetchDepths() {
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

  return data.depths.map(normalizeDepth);
}

async function loadInitialData() {
  try {
    state.depths = await fetchDepths();
    state.activeDepthId = state.depths[0].id;
    setSaveState("Loaded");
  } catch (error) {
    console.error(error);
    state.depths = [
      {
        id: uid(),
        name: "Depth 1",
        cells: makeEmptyCells()
      }
    ];
    state.activeDepthId = state.depths[0].id;
    setSaveState("Load failed", true);
    toast("Can't read depths.json. Is server.js running?");
  }
}

let saveTimer = null;
let saveChain = Promise.resolve();

function setSaveState(text, failed) {
  els.saveState.textContent = text;
  els.saveState.classList.toggle("is-error", Boolean(failed));
}

function scheduleSave() {
  setSaveState("Saving");
  clearTimeout(saveTimer);

  // chained so two writes can never land out of order
  saveTimer = setTimeout(() => {
    saveChain = saveChain.then(sendDepths);
  }, 350);
}

async function sendDepths() {
  try {
    const response = await fetch(DEPTHS_ENDPOINT, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: 1,
        gridSize: GRID_SIZE,
        depths: state.depths
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    setSaveState("Saved");
  } catch (error) {
    console.error(error);
    setSaveState("Not saved", true);
    toast(`Save failed: ${error.message}. Is server.js running?`);
  }
}

function activeDepth() {
  return state.depths.find((depth) => depth.id === state.activeDepthId) || null;
}

function buildGrid() {
  els.grid.innerHTML = "";

  for (let i = 0; i < CELL_COUNT; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "depth-cell";
    cell.dataset.index = i;

    cell.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();

      state.pointerDown = true;
      state.dragTouched.clear();
      applySelectedItem(i);

      window.addEventListener(
        "pointerup",
        () => {
          state.pointerDown = false;
          state.dragTouched.clear();
        },
        { once: true }
      );
    });

    cell.addEventListener("pointerenter", (event) => {
      if (state.pointerDown && event.buttons === 1) {
        applySelectedItem(i);
      }
    });

    els.grid.appendChild(cell);
  }
}

function renderGrid() {
  const depth = activeDepth();
  if (!depth) return;

  const cells = [...els.grid.querySelectorAll(".depth-cell")];

  depth.cells.forEach((cell, index) => {
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

    button.addEventListener("click", () => {
      state.activeDepthId = depth.id;
      renderAll();
    });

    els.depthList.appendChild(button);
  });
}

function renderDepthTitle() {
  els.depthTitle.textContent = activeDepth()?.name || "Depth";
}

function renderItemTable() {
  els.itemTable.innerHTML = "";

  ITEMS.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.classList.toggle("active", state.selectedItemId === item.id);

    const select = document.createElement("button");
    select.type = "button";
    select.className = "item-select";
    select.style.setProperty("--item-color", item.color);
    select.title = item.name;

    const symbol = document.createElement("span");
    symbol.className = "item-symbol";
    symbol.textContent = item.symbol;

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = item.name;

    select.append(symbol, name);

    select.addEventListener("click", () => {
      state.selectedItemId = item.id;
      renderItemTable();
    });

    row.appendChild(select);

    if (item.other) {
      row.appendChild(document.createElement("span"));

      const input = document.createElement("input");
      input.className = "item-other-input";
      input.type = "text";
      input.maxLength = 18;
      input.value = state.otherText;
      input.placeholder = "Write anything...";

      input.addEventListener("focus", () => {
        state.selectedItemId = item.id;
        row.classList.add("active");
      });

      input.addEventListener("input", (event) => {
        state.otherText = event.target.value.slice(0, 18);
        state.selectedItemId = item.id;
      });

      row.appendChild(input);

      const color = document.createElement("input");
      color.className = "item-other-color";
      color.type = "color";
      color.value = state.otherColor;
      color.title = "Text color";

      color.addEventListener("focus", () => {
        state.selectedItemId = item.id;
        row.classList.add("active");
      });

      color.addEventListener("input", (event) => {
        state.otherColor = event.target.value;
        state.selectedItemId = item.id;
      });

      row.appendChild(color);
    } else if (item.quantity !== false && !item.erase) {
      const qty = document.createElement("input");
      qty.className = "item-qty";
      qty.type = "number";
      qty.min = "1";
      qty.step = "1";
      qty.value = Math.max(1, Number(state.quantities[item.id] || 1));
      qty.title = `Quantity of ${item.name}`;

      qty.addEventListener("focus", () => {
        state.selectedItemId = item.id;
        row.classList.add("active");
      });

      qty.addEventListener("input", (event) => {
        state.quantities[item.id] = Math.max(
          1,
          parseInt(event.target.value || "1", 10)
        );
        state.selectedItemId = item.id;
      });

      row.appendChild(qty);
    } else {
      const dash = document.createElement("input");
      dash.className = "item-qty";
      dash.value = "—";
      dash.disabled = true;
      row.appendChild(dash);
    }

    if (item.special) {
      const input = document.createElement("input");
      input.className = "item-special-input";
      input.type = "text";
      input.maxLength = 10;
      input.value = state.specialText[item.id];
      input.placeholder = "Ruby, Sun...";

      input.addEventListener("focus", () => {
        state.selectedItemId = item.id;
        row.classList.add("active");
      });

      input.addEventListener("input", (event) => {
        state.specialText[item.id] = event.target.value.slice(0, 10);
        state.selectedItemId = item.id;
      });

      row.appendChild(input);

      const suffix = document.createElement("span");
      suffix.className = "item-special-suffix";
      suffix.textContent = item.suffix;
      row.appendChild(suffix);
    }

    els.itemTable.appendChild(row);
  });
}

function selectedItem() {
  return ITEMS.find((item) => item.id === state.selectedItemId) || ITEMS[0];
}

function buildCellFromItem(item) {
  if (item.erase) return { ...EMPTY_CELL };

  if (item.other) {
    return {
      text: (state.otherText || "Other").trim().slice(0, 18),
      textColor: state.otherColor,
      bgColor: item.bg
    };
  }

  if (item.special) {
    const name = state.specialText[item.id].trim();

    return {
      text: item.short.replace("{name}", name ? `${name} ${item.suffix}` : item.suffix),
      textColor: item.color,
      bgColor: item.bg
    };
  }

  if (item.quantity === false) {
    return {
      text: item.short,
      textColor: item.color,
      bgColor: item.bg
    };
  }

  const quantity = Math.max(1, Number(state.quantities[item.id] || 1));

  return {
    text: `${quantity} ${item.short}`.trim().slice(0, 18),
    textColor: item.color,
    bgColor: item.bg
  };
}

function applySelectedItem(index) {
  if (state.dragTouched.has(index)) return;
  state.dragTouched.add(index);

  const depth = activeDepth();
  if (!depth) return;

  depth.cells[index] = buildCellFromItem(selectedItem());
  scheduleSave();
  renderGrid();
}

function addDepth() {
  const name = prompt("New depth name:", `Depth ${state.depths.length + 1}`);
  if (name === null) return;

  const depth = {
    id: uid(),
    name: name.trim() || `Depth ${state.depths.length + 1}`,
    cells: makeEmptyCells()
  };

  state.depths.push(depth);
  state.activeDepthId = depth.id;
  scheduleSave();
  renderAll();
}

function duplicateDepth() {
  const source = activeDepth();
  if (!source) return;

  const copy = {
    id: uid(),
    name: `${source.name} copy`,
    cells: source.cells.map((cell) => ({ ...cell }))
  };

  state.depths.push(copy);
  state.activeDepthId = copy.id;
  scheduleSave();
  renderAll();
}

function renameDepth() {
  const depth = activeDepth();
  if (!depth) return;

  const name = prompt("New name:", depth.name);
  if (name === null) return;

  depth.name = name.trim() || depth.name;
  scheduleSave();
  renderAll();
}

function deleteDepth() {
  if (state.depths.length === 1) {
    alert("Keep at least one depth.");
    return;
  }

  const depth = activeDepth();
  if (!depth || !confirm(`Delete "${depth.name}"?`)) return;

  const index = state.depths.findIndex((item) => item.id === depth.id);
  state.depths.splice(index, 1);
  state.activeDepthId = state.depths[Math.max(0, index - 1)].id;
  scheduleSave();
  renderAll();
}

function clearDepth() {
  const depth = activeDepth();
  if (!depth || !confirm(`Clear all cells in "${depth.name}"?`)) return;

  depth.cells = makeEmptyCells();
  scheduleSave();
  renderGrid();
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2300);
}

function renderAll() {
  renderDepthList();
  renderDepthTitle();
  renderGrid();
  renderItemTable();
}

function cache() {
  [
    "saveState",
    "depthList",
    "depthTitle",
    "newDepthBtn",
    "duplicateDepthBtn",
    "renameDepthBtn",
    "deleteDepthBtn",
    "clearDepthBtn",
    "grid",
    "itemTable",
    "toast"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bind() {
  els.newDepthBtn.addEventListener("click", addDepth);
  els.duplicateDepthBtn.addEventListener("click", duplicateDepth);
  els.renameDepthBtn.addEventListener("click", renameDepth);
  els.deleteDepthBtn.addEventListener("click", deleteDepth);
  els.clearDepthBtn.addEventListener("click", clearDepth);
}

async function init() {
  cache();
  buildGrid();
  bind();
  await loadInitialData();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
