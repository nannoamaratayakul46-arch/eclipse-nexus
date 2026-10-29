const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));

const PORT = Number(process.env.PORT || 3000);
const BOT_URL = String(process.env.ECLIPSE_BOT_API_URL || "").replace(/[/]+$/, "");
const BOT_KEY = String(process.env.ECLIPSE_BOT_API_KEY || "");
const PASSWORD = String(process.env.NEXUS_LOGIN_PASSWORD || "");
const SECRET = String(process.env.NEXUS_COOKIE_SECRET || "");
const AI_API_KEY = String(process.env.AI_API_KEY || "");
const AI_MODEL = String(process.env.AI_MODEL || "gpt-4.1-mini");
const AI_BASE_URL = String(process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/[/]+$/, "");
const COOKIE = "eclipse_nexus_session";
const TTL = 8 * 60 * 60;
const attempts = new Map();
const aiAttempts = new Map();

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}
function makeToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + TTL,
    nonce: crypto.randomBytes(16).toString("hex")
  })).toString("base64url");
  return payload + "." + sign(payload);
}
function tokenFrom(req) {
  const item = String(req.headers.cookie || "").split(";").map(x => x.trim())
    .find(x => x.startsWith(COOKIE + "="));
  return item ? decodeURIComponent(item.slice(COOKIE.length + 1)) : "";
}
function validToken(token) {
  if (!token || SECRET.length < 32) return false;
  const i = token.lastIndexOf(".");
  if (i < 1 || !safeEqual(token.slice(i + 1), sign(token.slice(0, i)))) return false;
  try {
    return JSON.parse(Buffer.from(token.slice(0, i), "base64url").toString()).exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function requireAuth(req, res, next) {
  if (!validToken(tokenFrom(req))) return res.status(401).json({ error: "Please sign in again." });
  next();
}
function setCookie(req, res, value, maxAge = TTL) {
  const secure = req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
  res.setHeader("Set-Cookie", COOKIE + "=" + encodeURIComponent(value) +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAge + (secure ? "; Secure" : ""));
}
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/api/health", (_req, res) => res.json({
  ok: true,
  configured: Boolean(BOT_URL && BOT_KEY && PASSWORD && SECRET.length >= 32),
  aiConfigured: Boolean(AI_API_KEY)
}));
app.get("/api/session", (req, res) => res.json({ authenticated: validToken(tokenFrom(req)) }));
app.post("/api/login", (req, res) => {
  const ip = String(req.ip || "unknown");
  const now = Date.now();
  const old = attempts.get(ip);
  if (old && now - old.at < 10 * 60 * 1000 && old.count >= 8) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }
  if (!PASSWORD || !safeEqual(req.body?.password || "", PASSWORD)) {
    const state = old && now - old.at < 10 * 60 * 1000 ? old : { at: now, count: 0 };
    state.count++;
    attempts.set(ip, state);
    return res.status(401).json({ error: "Invalid dashboard password." });
  }
  attempts.delete(ip);
  setCookie(req, res, makeToken());
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => {
  setCookie(req, res, "", 0);
  res.json({ ok: true });
});

app.post("/api/ai/chat", requireAuth, async (req, res) => {
  if (!AI_API_KEY) return res.status(503).json({ error: "AI is not configured. Add AI_API_KEY and AI_MODEL to the server environment." });
  const ip = String(req.ip || "unknown"), now = Date.now(), prior = aiAttempts.get(ip);
  if (prior && now - prior.at < 60000 && prior.count >= 12) return res.status(429).json({ error: "AI rate limit reached. Wait one minute and try again." });
  const state = prior && now - prior.at < 60000 ? prior : { at: now, count: 0 };
  state.count++;
  aiAttempts.set(ip, state);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 4000) return res.status(400).json({ error: "Message must be between 1 and 4000 characters." });
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12)
    .filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string")
    .map(x => ({ role: x.role, content: x.content.slice(0, 4000) })) : [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch(AI_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + AI_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: "You are ECLIPSE, the conversational AI companion inside ECLIPSE NEXUS. Be helpful, direct, warm, and technically capable. You can explain dashboard telemetry only when it is supplied in the conversation; you cannot directly control the Messenger bot, inspect live telemetry, or send Messenger messages from this chat. Never claim to have performed an action. For bot actions, guide the user to the relevant NEXUS controls and require their confirmation." },
          ...history,
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 900
      })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status >= 500 ? 502 : upstream.status)
      .json({ error: data.error?.message || "Configured AI provider rejected the request." });
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return res.status(502).json({ error: "AI provider returned an empty response." });
    res.json({ reply: reply.trim(), model: AI_MODEL });
  } catch (error) {
    res.status(502).json({ error: error.name === "AbortError" ? "AI request timed out." : "Could not reach the configured AI provider." });
  } finally {
    clearTimeout(timeout);
  }
});

async function proxy(req, res, upstreamPath, { allowBody = false } = {}) {
  if (!BOT_URL || !BOT_KEY) return res.status(503).json({ error: "Bot API is not configured." });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL(BOT_URL + upstreamPath);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (typeof value === "string" && !["url", "path", "method"].includes(key)) url.searchParams.set(key, value);
    }
    const init = {
      method: req.method,
      headers: { "X-ECLIPSE-DASHBOARD-KEY": BOT_KEY, Accept: "application/json" },
      signal: controller.signal
    };
    if (allowBody && ["POST", "PUT", "PATCH"].includes(req.method)) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(req.body || {});
    }
    const upstream = await fetch(url, init);
    const body = await upstream.json().catch(() => ({ error: "Bot API returned a non-JSON response." }));
    return res.status(upstream.status).json(body);
  } catch (error) {
    return res.status(502).json({ error: error.name === "AbortError" ? "Bot API request timed out." : "Could not reach the bot API." });
  } finally {
    clearTimeout(timeout);
  }
}

const readRoutes = {
  status: "/api/dashboard/status",
  snapshot: "/api/dashboard/snapshot",
  health: "/api/dashboard/status",
  events: "/api/dashboard/events",
  analytics: "/api/dashboard/analytics",
  "delivery-analytics": "/api/dashboard/delivery-analytics",
  groups: "/api/dashboard/groups",
  "livechat-stats": "/api/dashboard/livechat/stats"
};
for (const [route, upstreamPath] of Object.entries(readRoutes)) {
  app.get("/api/bot/" + route, requireAuth, (req, res) => proxy(req, res, upstreamPath));
}
app.all("/api/bot/endpoint", requireAuth, async (req, res) => {
  const route = String(req.query.path || req.body?.path || "");
  const method = String(req.query.method || req.body?.method || req.method).toUpperCase();
  if (!route.startsWith("/api/dashboard/") || route.startsWith("//") || route.includes("..") ||
      /(?:auth|login|logout|session|cookie|secret|api-key)/i.test(route) ||
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return res.status(400).json({ error: "Endpoint or method is not allowed." });
  }
  const request = { ...req, method, body: req.body?.body && typeof req.body.body === "object" ? req.body.body : {} };
  return proxy(request, res, route, { allowBody: true });
});
app.get("/api/bot/groups/:threadId/members", requireAuth, (req, res) => {
  const id = String(req.params.threadId || "");
  if (!/^\d{1,128}$/.test(id)) return res.status(400).json({ error: "Invalid group ID." });
  return proxy(req, res, "/api/dashboard/groups/" + encodeURIComponent(id) + "/members");
});
app.post("/api/bot/groups/:threadId/chat/open", requireAuth, (req, res) => {
  const id = String(req.params.threadId || "");
  if (!/^\d{1,128}$/.test(id)) return res.status(400).json({ error: "Invalid group ID." });
  return proxy(req, res, "/api/dashboard/groups/" + encodeURIComponent(id) + "/chat/open", { allowBody: true });
});
app.post("/api/bot/groups/:threadId/chat/close", requireAuth, (req, res) => {
  const id = String(req.params.threadId || "");
  if (!/^\d{1,128}$/.test(id)) return res.status(400).json({ error: "Invalid group ID." });
  return proxy(req, res, "/api/dashboard/groups/" + encodeURIComponent(id) + "/chat/close", { allowBody: true });
});
app.get("/api/bot/groups/:threadId/chat", requireAuth, (req, res) => {
  const id = String(req.params.threadId || "");
  if (!/^\d{1,128}$/.test(id)) return res.status(400).json({ error: "Invalid group ID." });
  return proxy(req, res, "/api/dashboard/groups/" + encodeURIComponent(id) + "/chat");
});
app.post("/api/bot/groups/:threadId/chat/send", requireAuth, (req, res) => {
  const id = String(req.params.threadId || "");
  if (!/^\d{1,128}$/.test(id)) return res.status(400).json({ error: "Invalid group ID." });
  return proxy(req, res, "/api/dashboard/groups/" + encodeURIComponent(id) + "/chat/send", { allowBody: true });
});
app.delete("/api/bot/groups/:threadId/chat", requireAuth, (req, res) => {
  const id = String(req.params.threadId || "");
  if (!/^\d{1,128}$/.test(id)) return res.status(400).json({ error: "Invalid group ID." });
  return proxy(req, res, "/api/dashboard/groups/" + encodeURIComponent(id) + "/chat");
});

// Inject the 3D/AI companion module while leaving the existing dashboard markup intact.
for (const route of ["/", "/index.html"]) {
  app.get(route, (_req, res, next) => {
    fs.readFile(path.join(__dirname, "public", "index.html"), "utf8", (error, html) => {
      if (error) return next(error);
      const importMap = '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>';
      const moduleScript = '<script type="module" src="/companion.js"></script>';
      res.type("html").send(html.replace("</head>", importMap + "</head>").replace("</body>", moduleScript + "</body>"));
    });
  });
}
app.use(express.static(path.join(__dirname, "public"), { maxAge: "5m" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => {
  console.log("[NEXUS] listening on port " + PORT);
  if (!BOT_URL || !BOT_KEY || !PASSWORD || SECRET.length < 32) console.warn("[NEXUS] Required environment variables are not all configured.");
  if (!AI_API_KEY) console.warn("[NEXUS] AI companion is not configured (AI_API_KEY missing).");
});
