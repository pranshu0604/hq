#!/usr/bin/env node
// Warm assistant bridge — keeps ONE gemini --acp process alive (fast, no cold start),
// auto-restarts it if it dies, and exposes a tiny HTTP API the HQ app calls.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// load .env so GEMINI_MODEL / ASSISTANT_PORT can be set there
try {
  for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

const HOME = process.env.HOME || "/Users/pranshupandey";
const PROJECT = path.join(__dirname, "..");
const GEMINI = path.join(HOME, ".npm-global", "bin", "gemini");
const ENV_PATH = `/usr/local/bin:${path.join(HOME, ".npm-global", "bin")}:/opt/homebrew/bin:/usr/bin:/bin`;
const PORT = Number(process.env.ASSISTANT_PORT || 3413);

const SYSTEM = `You are the assistant built into HQ — the user's personal life OS. You have MCP tools (add_note, add_application, add_todo, add_reflection, add_person, log_interaction, add_quote, log_workout, add_company, add_work_item, log_health, add_meal, log_sleep, log_weight, get_targets, set_rhythm, upkeep_status, list_*, update_*, complete_todo, search, hq_summary). For anything about food, water, sleep, smoking, weight, cleaning their room, trimming their beard, or how they feel, use log_health/add_meal/log_sleep/log_weight — and call get_targets first when you need their calorie, protein or water numbers. When the user asks to add/log/update/find something, actually CALL the matching tool — don't just describe it. After acting, confirm in ONE short warm line (e.g. "Added that to your notes ✅"). Keep replies concise, no markdown headers.`;

class Acp {
  constructor() {
    this.pending = new Map();
    this.nextId = 1;
    this.sessionId = null;
    this.text = "";
    this.tools = 0;
    this.alive = false;
    this.start();
  }

  start() {
    this.buf = "";
    this.sessionId = null;
    const args = ["--acp", "--allowed-mcp-server-names", "hq", "--skip-trust"];
    if (process.env.GEMINI_MODEL) args.push("-m", process.env.GEMINI_MODEL); // optional model override
    this.g = spawn(GEMINI, args, {
      cwd: PROJECT,
      env: { ...process.env, PATH: ENV_PATH, HOME },
    });
    this.g.stdout.on("data", (d) => this.onData(d));
    this.g.stderr.on("data", () => {});
    this.g.on("exit", () => {
      this.alive = false;
      for (const [, p] of this.pending) p.reject(new Error("gemini exited"));
      this.pending.clear();
      setTimeout(() => this.start(), 1500); // auto-recover
    });
    this.ready = this.handshake();
  }

  onData(d) {
    this.buf += d;
    let i;
    while ((i = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      this.handle(j);
    }
  }

  handle(j) {
    if (j.id !== undefined && this.pending.has(j.id)) {
      const p = this.pending.get(j.id);
      this.pending.delete(j.id);
      if (j.error) p.reject(new Error(j.error.message || "acp error"));
      else p.resolve(j.result);
      return;
    }
    if (j.method === "session/update") {
      const u = j.params?.update;
      if (u?.sessionUpdate === "agent_message_chunk" && u.content?.text) this.text += u.content.text;
      else if (u?.sessionUpdate === "tool_call") this.tools += 1;
      return;
    }
    if (j.method === "session/request_permission") {
      // hq tools are trusted so this rarely fires; auto-approve defensively
      const opts = j.params?.options || [];
      const allow = opts.find((o) => /allow|yes|proceed|once|always/i.test(`${o.name} ${o.optionId} ${o.kind}`)) || opts[0];
      this.send({ jsonrpc: "2.0", id: j.id, result: { outcome: { outcome: "selected", optionId: allow?.optionId } } });
      return;
    }
    // any other agent->client request (fs/*, terminal/*): decline safely
    if (j.id !== undefined && j.method) {
      this.send({ jsonrpc: "2.0", id: j.id, error: { code: -32601, message: "not supported" } });
    }
  }

  send(o) {
    try { this.g.stdin.write(JSON.stringify(o) + "\n"); } catch {}
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("timeout")); }
      }, 180000);
    });
  }

  async handshake() {
    await this.request("initialize", { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } });
    this.alive = true;
  }

  async ensureSession(fresh) {
    if (fresh || !this.sessionId) {
      const r = await this.request("session/new", { cwd: PROJECT, mcpServers: [] });
      this.sessionId = r.sessionId;
      return true; // newly created
    }
    return false;
  }

  // serialized: one prompt at a time (ACP session is single-threaded)
  ask(message, fresh) {
    this.queue = (this.queue || Promise.resolve()).then(async () => {
      await this.ready;
      const isNew = await this.ensureSession(fresh);
      this.text = "";
      this.tools = 0;
      const text = isNew ? `${SYSTEM}\n\n${message}` : message;
      const r = await this.request("session/prompt", { sessionId: this.sessionId, prompt: [{ type: "text", text }] });
      return { reply: this.text.trim(), actions: this.tools, stopReason: r?.stopReason };
    });
    return this.queue;
  }
}

const acp = new Acp();
const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/", (_req, res) => res.json({ ok: true, alive: acp.alive, session: !!acp.sessionId }));

app.post("/ask", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const fresh = !!req.body?.fresh;
  if (!message) return res.json({ reply: "", actions: 0 });
  try {
    const out = await acp.ask(message, fresh);
    res.json(out);
  } catch (e) {
    res.status(200).json({ reply: "", actions: 0, error: e?.message || "assistant error" });
  }
});

app.post("/reset", (_req, res) => {
  acp.sessionId = null;
  res.json({ ok: true });
});

app.listen(PORT, "127.0.0.1", () => console.error(`[hq-assistant] warm bridge on http://127.0.0.1:${PORT}`));
