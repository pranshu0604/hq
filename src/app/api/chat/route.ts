import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

const HOME = process.env.HOME || "/Users/pranshupandey";
const GEMINI = path.join(HOME, ".npm-global", "bin", "gemini");
const CWD = process.cwd();
const ENV_PATH = `/usr/local/bin:${path.join(HOME, ".npm-global", "bin")}:/opt/homebrew/bin:/usr/bin:/bin`;
const BRIDGE = `http://127.0.0.1:${process.env.ASSISTANT_PORT || 3413}/ask`;

const SYSTEM = `You are the assistant built into HQ — the user's personal life OS. Use the hq_* MCP tools to read and modify their data. When asked to add/log/update/find something, actually call the matching tool. Confirm in one short warm line. Be concise. Never use shell, file, or web tools.`;

type Msg = { role: "user" | "assistant"; content: string };

// primary path: the warm PM2-managed bridge (persistent gemini --acp)
async function askBridge(message: string, fresh: boolean) {
  const res = await fetch(BRIDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, fresh }),
    signal: AbortSignal.timeout(195000),
  });
  return (await res.json()) as { reply?: string; actions?: number; error?: string };
}

// fallback: cold-spawn gemini once (used only if the bridge is unreachable)
function coldGemini(prompt: string): Promise<{ reply: string; actions: number; error?: string }> {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    const child = spawn(GEMINI, ["-p", prompt, "-o", "json"], { cwd: CWD, env: { ...process.env, PATH: ENV_PATH, HOME } });
    const timer = setTimeout(() => child.kill("SIGKILL"), 180000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", () => resolve({ reply: "", actions: 0, error: "Couldn't launch the assistant." }));
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out);
        resolve({ reply: (j.response ?? "").trim(), actions: j.stats?.tools?.totalCalls ?? 0 });
      } catch {
        resolve({ reply: out.trim(), actions: 0, error: out.trim() ? undefined : err.trim().slice(-300) });
      }
    });
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
  const message: string = (body.message ?? messages[messages.length - 1]?.content ?? "").trim();
  const fresh: boolean = body.fresh ?? messages.length <= 1;
  if (!message) return NextResponse.json({ reply: "", actions: 0 });

  try {
    const out = await askBridge(message, fresh);
    if (out && (out.reply || out.error)) return NextResponse.json({ reply: out.reply ?? "", actions: out.actions ?? 0, error: out.error });
  } catch {
    // bridge down → fall through to cold spawn
  }

  const prompt = `${SYSTEM}\n\nUser: ${message}`;
  const res = await coldGemini(prompt);
  return NextResponse.json({ reply: res.reply, actions: res.actions, error: res.reply ? undefined : res.error });
}
