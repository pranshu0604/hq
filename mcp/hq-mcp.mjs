#!/usr/bin/env node
// HQ MCP server (stdio) — for Claude Desktop / Claude Code / Cursor.
// Run: node mcp/hq-mcp.mjs
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaClient } from "@prisma/client";
import { registerTools } from "./tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(__dirname, "..", "prisma", "dev.db")}`;

const prisma = new PrismaClient();
const server = new McpServer({ name: "hq", version: "1.0.0" });
registerTools(server, prisma);

await server.connect(new StdioServerTransport());
