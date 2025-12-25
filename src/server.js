import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { addCard, getCards } from "./cardStore.js";
import { buildRecommendation } from "./scoring.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
const rulesPath = path.join(__dirname, "..", "data", "rules.json");
const appsPath = path.join(__dirname, "..", "data", "apps.json");
const port = process.env.PORT || 3000;
const recommendationCache = new Map();
const cacheTtlMs = 2000;
let cachedCards = null;
let cachedRules = null;
let cachedApps = null;
let lastDataLoad = 0;

const contentTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
};

const readRules = async () => {
  const file = await fs.readFile(rulesPath, "utf-8");
  return JSON.parse(file);
};

const readApps = async () => {
  const file = await fs.readFile(appsPath, "utf-8");
  return JSON.parse(file);
};

const loadData = async () => {
  const now = Date.now();
  if (now - lastDataLoad < cacheTtlMs && cachedCards && cachedRules && cachedApps) {
    return { cards: cachedCards, rules: cachedRules, apps: cachedApps };
  }

  const [cards, rules, apps] = await Promise.all([getCards(), readRules(), readApps()]);
  cachedCards = cards;
  cachedRules = rules;
  cachedApps = apps;
  lastDataLoad = now;
  return { cards, rules, apps };
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const collectBody = (req) => new Promise((resolve) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    resolve(body);
  });
});

const parseJsonBody = (body) => {
  if (!body) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
};

const handleApi = async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/cards") {
    const { cards } = await loadData();
    sendJson(res, 200, { cards });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/cards") {
    const payload = parseJsonBody(await collectBody(req));
    if (!payload) {
      sendJson(res, 400, { error: "invalid JSON payload" });
      return true;
    }
    if (!payload?.name || !payload?.network) {
      sendJson(res, 400, { error: "name and network are required" });
      return true;
    }

    const card = await addCard(payload);
    cachedCards = null;
    lastDataLoad = 0;
    sendJson(res, 201, { card });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/rules") {
    const { rules } = await loadData();
    sendJson(res, 200, { rules });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/apps") {
    const { apps } = await loadData();
    sendJson(res, 200, { apps });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/recommendation") {
    const input = parseJsonBody(await collectBody(req));
    if (!input) {
      sendJson(res, 400, { error: "invalid JSON payload" });
      return true;
    }
    if (!input?.amount || !input?.category) {
      sendJson(res, 400, { error: "amount and category are required" });
      return true;
    }

    const cacheKey = JSON.stringify(input);
    const cached = recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      sendJson(res, 200, { recommendation: cached.payload, cached: true });
      return true;
    }

    const { cards, rules, apps } = await loadData();
    const recommendation = buildRecommendation({ cards, input, rules, apps });
    recommendationCache.set(cacheKey, { timestamp: Date.now(), payload: recommendation });
    sendJson(res, 200, { recommendation });
    return true;
  }

  return false;
};

const serveStatic = async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(publicDir, urlPath);

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[extension] || "text/plain" });
    res.end(file);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
};

const server = http.createServer(async (req, res) => {
  const handled = await handleApi(req, res);
  if (handled) {
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Smart Wallet server running on http://localhost:${port}`);
});
