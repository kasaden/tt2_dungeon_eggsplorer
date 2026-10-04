"use strict";

// Checks the shape of depths.json, the same rules server.js applies when the editor saves.
// Run it before opening a pull request that touches the maps: node scripts/check-depths.js

const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "..", "depths.json");
const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const MAX_TEXT = 32;

const errors = [];
const warnings = [];

let data;

try {
  data = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (error) {
  console.error(`depths.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (Number(data.gridSize) !== GRID_SIZE) errors.push(`gridSize must be ${GRID_SIZE}`);

if (!Array.isArray(data.depths) || data.depths.length === 0) {
  errors.push("depths must be a non-empty array");
} else {
  const ids = new Set();
  const names = new Set();

  data.depths.forEach((depth, index) => {
    const where = `depth ${index + 1}`;

    if (typeof depth?.id !== "string" || typeof depth?.name !== "string") {
      errors.push(`${where}: needs a string id and a string name`);
      return;
    }

    if (ids.has(depth.id)) errors.push(`${where}: duplicate id ${depth.id}`);
    if (names.has(depth.name)) warnings.push(`${where}: another depth is already named "${depth.name}"`);
    ids.add(depth.id);
    names.add(depth.name);

    if (!Array.isArray(depth.cells) || depth.cells.length !== CELL_COUNT) {
      errors.push(`${depth.name}: needs exactly ${CELL_COUNT} cells`);
      return;
    }

    depth.cells.forEach((cell, cellIndex) => {
      const coord = `${String.fromCharCode(65 + (cellIndex % GRID_SIZE))}${Math.floor(cellIndex / GRID_SIZE) + 1}`;

      if (typeof cell?.text !== "string") {
        errors.push(`${depth.name} ${coord}: text must be a string`);
      } else if (cell.text.length > MAX_TEXT) {
        // the viewer cuts cell text at 32 characters when it loads
        warnings.push(`${depth.name} ${coord}: text is longer than ${MAX_TEXT} characters and will be cut`);
      }
    });
  });
}

warnings.forEach((message) => console.warn(`warning: ${message}`));

if (errors.length > 0) {
  errors.forEach((message) => console.error(`error: ${message}`));
  process.exit(1);
}

console.log(`depths.json ok: ${data.depths.length} depths, ${CELL_COUNT} cells each`);
