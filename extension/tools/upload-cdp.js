#!/usr/bin/env node
/*
 * Auto-attach a local file to a file input in a running Comet/Chromium tab, via the
 * Chrome DevTools Protocol. This is the one way to bypass the browser's block on
 * scripts setting <input type=file> — it uses DOM.setFileInputFiles over CDP.
 *
 * REQUIREMENT: the browser must be launched with --remote-debugging-port=9222.
 *   Quit Comet fully (Cmd+Q), then run:  ./comet-debug.sh   (or see it for the command)
 *
 * Usage:
 *   node upload-cdp.js --file <path> [--url <substr>] [--selector <css>] [--index N] [--port 9222]
 *
 * --file      absolute (or ~-prefixed) path to the file to attach   [required]
 * --url       only attach on a tab whose URL contains this substring (e.g. "greenhouse")
 * --selector  which inputs to consider (default: input[type=file])
 * --index     which matched input to use when there are several (default: 0 = the first)
 * --port      remote debugging port (default: 9222)
 *
 * Zero npm deps — uses Node 22's built-in fetch + WebSocket.
 */
const fs = require("fs");
const path = require("path");

const argv = process.argv;
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};

const port = arg("port", "9222");
let file = arg("file");
const urlSub = arg("url", "");
const selector = arg("selector", "input[type=file]");
const index = parseInt(arg("index", "0"), 10);

if (!file) {
  console.error("ERROR: --file <path> is required");
  process.exit(1);
}
file = path.resolve(file.replace(/^~(?=\/|$)/, process.env.HOME || ""));
if (!fs.existsSync(file)) {
  console.error("ERROR: file not found: " + file);
  process.exit(1);
}

const fail = (msg, code) => {
  console.error("ERROR: " + msg);
  process.exit(code);
};

const timer = setTimeout(() => fail("timed out after 20s", 8), 20000);

(async () => {
  let targets;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    targets = await res.json();
  } catch {
    fail(
      `cannot reach the browser on port ${port}. Quit Comet, then relaunch it with ` +
        `--remote-debugging-port=${port} (run comet-debug.sh).`,
      2
    );
  }

  const pages = targets.filter((t) => t.type === "page" && t.webSocketDebuggerUrl);
  let target = urlSub && pages.find((p) => (p.url || "").includes(urlSub));
  if (!target) target = pages.find((p) => !/^(chrome|devtools|about|edge):/.test(p.url || ""));
  if (!target) fail("no matching application-form tab found. Open the form and retry.", 3);
  console.error(`Attaching to tab: ${target.title || ""} — ${target.url}`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let idc = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++idc;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", () => rej(new Error("websocket error connecting to the tab")));
  }).catch((e) => fail(e.message, 5));

  try {
    console.error("· connected, enabling DOM…");
    await send("DOM.enable");
    console.error("· getting document root…");
    const doc = await send("DOM.getDocument", { depth: 0 }); // just the root node; querySelectorAll searches live
    console.error("· querying for " + selector + " …");
    const { nodeIds } = await send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector });
    if (!nodeIds || !nodeIds.length) fail(`no element matched "${selector}" on that page.`, 4);
    if (index >= nodeIds.length)
      fail(`index ${index} out of range — only ${nodeIds.length} matched "${selector}".`, 4);
    await send("DOM.setFileInputFiles", { files: [file], nodeId: nodeIds[index] });
    clearTimeout(timer);
    console.log(
      `OK: attached "${path.basename(file)}" to file input #${index} ` +
        `(${nodeIds.length} on page).`
    );
    ws.close();
    process.exit(0);
  } catch (e) {
    fail(e.message, 6);
  }
})();
