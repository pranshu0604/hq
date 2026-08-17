#!/usr/bin/env node
// HQ MCP server (HTTP / Streamable) — for remote clients like ChatGPT connectors.
// Bearer-token protected. Expose via a tunnel; never run it open on the internet.
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import { registerTools } from "./tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// load .env (these servers run outside Next, which normally loads it)
try {
  for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

process.env.DATABASE_URL = `file:${path.join(__dirname, "..", "prisma", "dev.db")}`;

const TOKEN = process.env.MCP_TOKEN;
const PORT = Number(process.env.MCP_HTTP_PORT || 3412);
if (!TOKEN) {
  console.error("[hq-mcp-http] MCP_TOKEN not set — refusing to start without auth.");
  process.exit(1);
}

const prisma = new PrismaClient();
const app = express();
app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// unauthenticated health check to verify the tunnel is reachable
app.get("/", (_req, res) => res.json({ ok: true, service: "hq-mcp", endpoint: "/mcp" }));

// bearer-token auth on the MCP endpoint
app.use("/mcp", (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = (auth.startsWith("Bearer ") ? auth.slice(7) : null) || req.query.token;
  if (token !== TOKEN) {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "unauthorized" }, id: null });
    return;
  }
  next();
});

// session-managed Streamable HTTP
const transports = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId ? transports[sessionId] : undefined;

  if (!transport) {
    if (sessionId || !isInitializeRequest(req.body)) {
      res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session; send initialize first." }, id: null });
      return;
    }
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };
    const server = new McpServer({ name: "hq", version: "1.0.0" });
    registerTools(server, prisma);
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

const bySession = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing session id");
    return;
  }
  await transport.handleRequest(req, res);
};
app.get("/mcp", bySession);
app.delete("/mcp", bySession);

app.listen(PORT, "127.0.0.1", () => {
  console.error(`[hq-mcp-http] listening on http://127.0.0.1:${PORT}/mcp (auth required)`);
});
