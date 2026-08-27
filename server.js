"use strict";

// dev server: serves the files and saves depths.json. localhost only.

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = __dirname;
const DEPTHS_FILE = path.join(ROOT, "depths.json");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const MAX_BODY = 5 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function validateDepthsFile(data) {
  if (!data || typeof data !== "object") {
    throw new Error("not an object");
  }

  if (Number(data.gridSize) !== GRID_SIZE) {
    throw new Error(`gridSize must be ${GRID_SIZE}`);
  }

  if (!Array.isArray(data.depths) || data.depths.length === 0) {
    throw new Error("no depths");
  }

  const valid = data.depths.every(
    (depth) =>
      depth &&
      typeof depth.id === "string" &&
      typeof depth.name === "string" &&
      Array.isArray(depth.cells) &&
      depth.cells.length === CELL_COUNT &&
      depth.cells.every((cell) => cell && typeof cell.text === "string")
  );

  if (!valid) {
    throw new Error(`bad depth: need id, name and ${CELL_COUNT} cells`);
  }

  return {
    version: 1,
    gridSize: GRID_SIZE,
    depths: data.depths
  };
}

// temp file + rename, otherwise a crash mid-write truncates depths.json
async function writeDepths(data) {
  const temp = `${DEPTHS_FILE}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temp, DEPTHS_FILE);
}

async function handleSaveDepths(request, response) {
  let depths;

  try {
    depths = validateDepthsFile(JSON.parse(await readBody(request)));
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  try {
    await writeDepths(depths);
  } catch (error) {
    console.error("write failed:", error);
    sendJson(response, 500, { error: "write failed" });
    return;
  }

  console.log(`saved ${depths.depths.length} depths`);
  sendJson(response, 200, { ok: true, depths: depths.depths.length });
}

async function serveStatic(requestPath, response) {
  const relative = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath).slice(1);
  const file = path.join(ROOT, relative);

  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = await fs.readFile(file);
    response.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, `http://${HOST}:${PORT}`).pathname;

  if (requestPath === "/api/depths") {
    if (request.method === "PUT") {
      handleSaveDepths(request, response);
      return;
    }
    sendJson(response, 405, { error: "use PUT" });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "method not allowed" });
    return;
  }

  serveStatic(requestPath, response);
});

server.listen(PORT, HOST, () => {
  console.log(`editor  http://${HOST}:${PORT}/edit.html`);
  console.log(`viewer  http://${HOST}:${PORT}/`);
});
