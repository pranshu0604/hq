// HQ desktop shell — wraps the local HQ web app (already served by PM2 on :3411)
// and adds the executive-function layer that can't live in a browser tab:
//   • a floating always-on-top "beacon" (wall clock, becomes NOW during focus)
//   • a focus-session timer with a quick global-hotkey start
//   • the menu bar showing what you're doing right now
// The beacon runs on local state so it never depends on the server, but it
// mirrors sessions to (and adopts them from) the shared /api/now contract so the
// web dashboard and the desktop always agree.

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, screen, globalShortcut, Notification } = require("electron");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const { exec } = require("node:child_process");

// Start Mode uses two macOS Shortcuts you create once (Shortcuts.app → New):
//   "HQ Focus On"  → Set Focus / Do Not Disturb on
//   "HQ Focus Off" → turn it off
// If they don't exist, this is a silent no-op — nothing breaks.
const FOCUS_ON = "HQ Focus On";
const FOCUS_OFF = "HQ Focus Off";
function runShortcut(name) {
  exec(`shortcuts run ${JSON.stringify(name)}`, () => {});
}

// Context Shield: clear time-sink apps that are almost never your focus target.
// Browsers are deliberately excluded — too often legitimately part of the work.
const DISTRACTING = new Set(["Messages", "Slack", "Discord", "WhatsApp", "Telegram", "Music", "TV", "Photos", "App Store", "Mail"]);
let lastShieldApp = "";

const BASE = process.env.HQ_URL || "http://localhost:3411";
const ASSETS = path.join(__dirname, "assets");

// quick-jump destinations shown in the menu bar
const LINKS = [
  { label: "Dashboard", route: "/" },
  { label: "Inbox", route: "/inbox" },
  { label: "Wellbeing", route: "/wellbeing" },
  { label: "To-dos", route: "/todos" },
  { label: "Work", route: "/work" },
  { label: "Notes", route: "/notes" },
];

// Global hotkeys. Deliberately off ⌘Space / ⌥⌘Space (Spotlight & "Search This
// Mac") and off the browser dev-tools combos (⌥⌘I/J/C/U). All rebindable here.
const HOTKEYS = {
  start: "Alt+Command+N", // NOW — start a focus session
  capture: "Alt+Command+K", // global capture (task/worry/idea)
  rabbit: "Alt+Command+R", // rabbit-hole capture during focus
  overload: "Alt+Command+O", // "I'm overwhelmed" → collapse to one thing
  culture: "Alt+Command+Y", // enter Culture mode (leisure, no guilt)
  beacon: "Alt+Command+B", // toggle the floating clock
};

// the inset that keeps the traffic lights clear of the app. The strip is transparent —
// body's own themed background paints through it — so it matches light/dark automatically.
const TITLEBAR_CSS = `
  :root { --hq-titlebar: 30px; }
  body { padding-top: var(--hq-titlebar) !important; box-sizing: border-box; }
  body > aside { height: calc(100vh - var(--hq-titlebar)) !important; top: var(--hq-titlebar) !important; }
  #hq-drag { position: fixed; top: 0; left: 0; right: 0; height: var(--hq-titlebar);
    -webkit-app-region: drag; z-index: 2147483647; background: transparent; }
  #hq-drag * { -webkit-app-region: no-drag; }
`;

let mainWindow = null;
let beacon = null;
let promptWin = null;
let promptMode = "start";
let overloadWin = null;
let lastOverload = null;
let transitionWin = null;
let lastTransition = null;
let tray = null;
let tickTimer = null;
let cursorTimer = null;
let pollTimer = null;
let reminderTimer = null;
let shieldTimer = null;
let traySummary = { counts: null, next: null };

// ---------------------------------------------------------------------------
// window state: remember size + position across launches
// ---------------------------------------------------------------------------
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1280, height: 860 };
  }
}

function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return;
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(mainWindow.getBounds()));
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// server readiness: PM2 may still be booting when we launch
// ---------------------------------------------------------------------------
function ping(url, timeout = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      res.resume();
      resolve(res.statusCode > 0);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(tries = 20) {
  for (let i = 0; i < tries; i++) {
    if (await ping(BASE)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const OFFLINE_HTML = `data:text/html,${encodeURIComponent(`
  <html><head><style>
    html,body{height:100%;margin:0;background:#0f1115;color:#e7e3da;
      font:15px/1.5 -apple-system,system-ui,sans-serif;display:grid;place-items:center}
    .box{text-align:center;max-width:360px;padding:24px}
    h1{font-size:17px;margin:0 0 8px;color:#dc9a58}
    p{margin:0 0 18px;color:#9a958c}
    button{background:#dc9a58;color:#0f1115;border:0;border-radius:8px;
      padding:9px 18px;font-weight:600;cursor:pointer}
  </style></head><body><div class="box">
    <h1>HQ isn't responding</h1>
    <p>The local server at ${BASE} isn't up yet. It runs under PM2 — give it a moment.</p>
    <button onclick="location.reload()">Retry</button>
  </div></body></html>`)}`;

async function loadApp(route = "/") {
  if (!mainWindow) return;
  const up = await ping(BASE);
  if (up) {
    mainWindow.loadURL(`${BASE}${route}`);
  } else {
    mainWindow.loadURL(OFFLINE_HTML);
    waitForServer().then((ok) => ok && mainWindow && mainWindow.loadURL(`${BASE}${route}`));
  }
}

// ---------------------------------------------------------------------------
// NOW sync — best-effort bridge to the shared /api/now contract. The beacon
// never depends on the server (it's a local clock); this just keeps the web
// dashboard and the desktop in agreement.
// ---------------------------------------------------------------------------
// best-effort JSON POST to a local HQ endpoint — fire-and-forget
function httpPost(pathname, obj) {
  try {
    const data = JSON.stringify(obj);
    const u = new URL(`${BASE}${pathname}`);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: "POST", timeout: 1500, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } },
      (res) => res.resume(),
    );
    req.on("error", () => {});
    req.on("timeout", () => req.destroy());
    req.write(data);
    req.end();
  } catch {
    /* offline — desktop keeps working locally */
  }
}

const apiPost = (action, extra = {}) => httpPost("/api/now", { action, ...extra });

function httpGetJson(pathname) {
  return new Promise((resolve) => {
    try {
      const u = new URL(`${BASE}${pathname}`);
      const req = http.get({ hostname: u.hostname, port: u.port, path: u.pathname, timeout: 1500 }, (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b));
          } catch {
            resolve(null);
          }
        });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

const apiGetNow = () => httpGetJson("/api/now").then((d) => (d && d.now) || null);

// actionable overlay for a due transition — Start / Snooze / Skip right there
function ensureTransition() {
  if (transitionWin && !transitionWin.isDestroyed()) return transitionWin;
  transitionWin = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, "transition-preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  transitionWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  transitionWin.setAlwaysOnTop(true, "screen-saver");
  transitionWin.loadFile(path.join(__dirname, "transition.html"));
  transitionWin.webContents.on("did-finish-load", () => lastTransition && transitionWin && transitionWin.webContents.send("transition:data", lastTransition));
  transitionWin.on("blur", () => transitionWin && transitionWin.hide());
  return transitionWin;
}

function showTransition(nudge) {
  lastTransition = nudge;
  ensureTransition();
  const cur = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(cur).workArea;
  transitionWin.setBounds({ x: Math.round(wa.x + (wa.width - 460) / 2), y: Math.round(wa.y + (wa.height - 300) / 2), width: 460, height: 300 });
  transitionWin.show();
  transitionWin.focus();
  transitionWin.webContents.send("transition:data", nudge);
}

// scheduled-transition nudges — the server decides what's due. Lead = gentle
// notification; start/late = the actionable overlay (first one), notify the rest.
async function pollReminders() {
  const res = await httpPostJson("/api/schedule", { action: "poll" });
  const due = (res && res.due) || [];
  if (!due.length) return;
  let overlayShown = false;
  for (const d of due) {
    if (d.type === "lead") {
      if (Notification.isSupported()) new Notification({ title: `${d.label} — in ${d.leadMin} min`, body: "Start wrapping up what you're on.", silent: true }).show();
    } else if (!overlayShown) {
      showTransition(d);
      overlayShown = true;
    } else if (Notification.isSupported()) {
      new Notification({ title: d.type === "late" ? `Still haven't started: ${d.label}` : `${d.label} — now`, body: "Open HQ to act." }).show();
    }
  }
}

// like httpPost but awaits + parses the JSON response
function httpPostJson(pathname, obj) {
  return new Promise((resolve) => {
    try {
      const data = JSON.stringify(obj);
      const u = new URL(`${BASE}${pathname}`);
      const req = http.request(
        { hostname: u.hostname, port: u.port, path: u.pathname, method: "POST", timeout: 1500, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } },
        (res) => {
          let b = "";
          res.on("data", (c) => (b += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(b));
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.write(data);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// Context Shield — during a FOCUS session, notice when you slip into a clear
// time-sink app and nudge once (assist, don't nag). Needs macOS Automation
// permission for System Events (granted on first prompt).
function checkShield() {
  if (!session.active || session.paused || session.done || session.kind === "CULTURE") {
    lastShieldApp = "";
    return;
  }
  exec(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`, (err, stdout) => {
    if (err) return;
    const appName = (stdout || "").trim();
    if (!appName) return;
    if (DISTRACTING.has(appName)) {
      if (appName !== lastShieldApp) {
        lastShieldApp = appName;
        if (Notification.isSupported()) {
          new Notification({ title: `${appName}, not ${session.label}`, body: "Back to it — or ⌥⌘R to save the tangent for later.", silent: true }).show();
        }
      }
    } else {
      lastShieldApp = ""; // on task (or a non-flagged app) — re-arm
    }
  });
}

// keep the menu-bar panel fresh (NEXT reminder + set-aside counts)
async function refreshTraySummary() {
  const [ov, sc] = await Promise.all([httpGetJson("/api/overload"), httpGetJson("/api/schedule")]);
  traySummary.counts = (ov && ov.counts) || null;
  const rems = (sc && sc.reminders) || [];
  const nowMs = Date.now();
  traySummary.next =
    rems
      .filter((r) => r.status === "PENDING" && new Date(r.at).getTime() >= nowMs)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())[0] || null;
  rebuildTrayMenu();
}

// pull a session that was started from the web into the local beacon
function adoptNow(n) {
  if (!n || n.status !== "ACTIVE") return;
  session.active = true;
  session.paused = !!n.paused;
  session.done = !!n.done;
  session.kind = n.kind === "CULTURE" ? "CULTURE" : "FOCUS";
  session.label = n.label || "Focus";
  session.nextAction = n.nextAction || "";
  session.remainingMs = n.remainingMs || 0;
  session.endsAt = new Date(n.endsAt).getTime();
  session.startMs = n.startedAt ? new Date(n.startedAt).getTime() : Date.now();
  session.hyperNudged = false;
  ensureBeacon();
  beacon && beacon.show();
  pushBeacon();
  updateTray();
  rebuildTrayMenu();
  // Start Mode also applies to sessions started from the web: DND on, and open
  // the project workspace if this session is tied to one.
  if (session.kind === "FOCUS") runShortcut(FOCUS_ON);
  if (n.projectId) showWindow(`/projects/${n.projectId}`);
}

// ---------------------------------------------------------------------------
// main window
// ---------------------------------------------------------------------------
function createWindow() {
  const s = loadState();
  mainWindow = new BrowserWindow({
    width: s.width,
    height: s.height,
    x: s.x,
    y: s.y,
    minWidth: 380,
    minHeight: 560,
    title: "HQ",
    backgroundColor: "#0f1115",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 10 },
    icon: path.join(ASSETS, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadApp("/");

  // reserve a draggable strip at the top so the macOS traffic-light buttons don't
  // sit on top of the app's sidebar. Re-applied on every navigation.
  mainWindow.webContents.on("dom-ready", () => {
    if (!mainWindow.webContents.getURL().startsWith(BASE)) return;
    mainWindow.webContents.insertCSS(TITLEBAR_CSS);
    mainWindow.webContents.executeJavaScript(
      `(function(){if(!document.getElementById('hq-drag')){var d=document.createElement('div');d.id='hq-drag';document.body.appendChild(d);}})();`,
    );
  });

  const isInternal = (url) => url.startsWith(BASE);
  const isHandbookRaw = (url) => /\/handbooks\/[^/]+\/raw(\?|#|$)/.test(url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // handbooks: open the rendered HTML in the default browser (isolated), even
    // though it's an internal URL — otherwise an internal _blank link goes nowhere.
    if (!isInternal(url) || isHandbookRaw(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!isInternal(url) && !url.startsWith("data:")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  ["resize", "move"].forEach((ev) => mainWindow.on(ev, saveState));

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      saveState();
    }
  });
}

function showWindow(route) {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (route) loadApp(route);
  mainWindow.show();
  mainWindow.focus();
}

// ===========================================================================
// FOCUS SESSION  — the NOW engine (shell-side for now)
// ===========================================================================
const session = {
  active: false,
  paused: false,
  done: false,
  label: "",
  kind: "FOCUS", // FOCUS | CULTURE
  nextAction: "",
  endsAt: 0, // epoch ms when the timer runs out
  remainingMs: 0, // authoritative remaining, held while paused
  startMs: 0, // when this session began (for the hyperfocus check-in)
  hyperNudged: false, // fired the "still going?" nudge yet
};

function remaining() {
  if (!session.active) return 0;
  if (session.paused || session.done) return session.remainingMs;
  return Math.max(0, session.endsAt - Date.now());
}

function fmtClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function startSession(label, minutes, kind = "FOCUS") {
  session.active = true;
  session.paused = false;
  session.done = false;
  session.kind = kind === "CULTURE" ? "CULTURE" : "FOCUS";
  session.label = label || (session.kind === "CULTURE" ? "Culture" : "Focus");
  session.nextAction = "";
  session.remainingMs = Math.max(1, minutes) * 60_000;
  session.endsAt = Date.now() + session.remainingMs;
  session.startMs = Date.now();
  session.hyperNudged = false;
  ensureBeacon();
  beacon && beacon.show();
  pushBeacon();
  updateTray();
  rebuildTrayMenu();
  apiPost("start", { label: session.label, minutes, kind: session.kind });
  // Start Mode: focus sessions flip on Do Not Disturb; culture is left alone
  if (session.kind === "FOCUS") runShortcut(FOCUS_ON);
}

function pauseSession() {
  if (!session.active || session.done) return;
  if (session.paused) {
    session.paused = false;
    session.endsAt = Date.now() + session.remainingMs;
  } else {
    session.remainingMs = remaining();
    session.paused = true;
  }
  pushBeacon();
  updateTray();
  rebuildTrayMenu();
  apiPost("pause");
}

function finishSession() {
  session.active = false;
  session.paused = false;
  session.done = false;
  session.label = "";
  session.nextAction = "";
  session.remainingMs = 0;
  pushBeacon(); // beacon falls back to the wall clock
  updateTray();
  rebuildTrayMenu();
  apiPost("finish", { status: "DONE" });
  runShortcut(FOCUS_OFF); // Start Mode: release Do Not Disturb
}

function completeSession() {
  // timer hit zero — mark done but keep it on screen until acknowledged
  session.done = true;
  session.paused = false;
  session.remainingMs = 0;
  pushBeacon();
  updateTray();
  rebuildTrayMenu();
  if (Notification.isSupported()) {
    const culture = session.kind === "CULTURE";
    const n = new Notification({
      title: culture ? "Culture time's up" : "Focus session complete",
      body: culture ? `${session.label} — still enjoying it? No rush, just a nudge.` : `${session.label} — time's up.`,
      silent: false,
    });
    n.show();
  }
}

function beaconPayload() {
  return {
    active: session.active,
    paused: session.paused,
    done: session.done,
    label: session.label,
    kind: session.kind,
    nextAction: session.nextAction,
    remainingMs: remaining(),
  };
}

function pushBeacon() {
  if (beacon && !beacon.isDestroyed()) beacon.webContents.send("beacon:update", beaconPayload());
}

// ===========================================================================
// BEACON  — floating always-on-top clock / NOW display that dodges the cursor
// ===========================================================================
const BEACON_W = 200;
const BEACON_H = 66;
const BEACON_MARGIN = 18;

function beaconCorners(display) {
  const wa = display.workArea;
  return [
    { x: wa.x + BEACON_MARGIN, y: wa.y + BEACON_MARGIN }, // top-left
    { x: wa.x + wa.width - BEACON_W - BEACON_MARGIN, y: wa.y + BEACON_MARGIN }, // top-right
    { x: wa.x + BEACON_MARGIN, y: wa.y + wa.height - BEACON_H - BEACON_MARGIN }, // bottom-left
    { x: wa.x + wa.width - BEACON_W - BEACON_MARGIN, y: wa.y + wa.height - BEACON_H - BEACON_MARGIN }, // bottom-right
  ];
}

function ensureBeacon() {
  if (beacon && !beacon.isDestroyed()) return beacon;
  const display = screen.getPrimaryDisplay();
  const corner = beaconCorners(display)[1]; // start top-right
  beacon = new BrowserWindow({
    width: BEACON_W,
    height: BEACON_H,
    x: corner.x,
    y: corner.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false, // never steals focus — purely ambient
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "beacon-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  beacon.setAlwaysOnTop(true, "screen-saver"); // float above fullscreen apps too
  beacon.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  beacon.loadFile(path.join(__dirname, "beacon.html"));
  beacon.webContents.on("did-finish-load", () => pushBeacon());
  return beacon;
}

function toggleBeacon() {
  ensureBeacon();
  if (beacon.isVisible()) beacon.hide();
  else {
    beacon.show();
    pushBeacon();
  }
  rebuildTrayMenu();
}

// The beacon physically RUNS from the cursor: every frame it takes a small step
// directly away, faster the closer the cursor is, and slides along the screen
// edge when cornered. Continuous motion — never teleports.
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function fleeCursor() {
  if (!beacon || beacon.isDestroyed() || !beacon.isVisible()) return;
  const cur = screen.getCursorScreenPoint();
  const b = beacon.getBounds();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const dx = cx - cur.x;
  const dy = cy - cur.y;
  const dist = Math.hypot(dx, dy) || 1;

  const R = 210; // start fleeing once the cursor is within this radius
  if (dist >= R) return; // otherwise hold still where it ended up

  const wa = screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(cy) }).workArea;
  const minX = wa.x + BEACON_MARGIN;
  const maxX = wa.x + wa.width - b.width - BEACON_MARGIN;
  const minY = wa.y + BEACON_MARGIN;
  const maxY = wa.y + wa.height - b.height - BEACON_MARGIN;

  const push = (R - dist) / R; // 0..1, stronger when closer
  const speed = 3 + push * 17; // px this frame — a quick scurry, not a jump
  const ux = dx / dist;
  const uy = dy / dist;
  let nx = b.x + ux * speed;
  let ny = b.y + uy * speed;

  // cornered against a wall → convert the blocked push into a slide along it,
  // in whichever direction increases distance from the cursor.
  if (nx <= minX || nx >= maxX) {
    nx = clampN(nx, minX, maxX);
    ny += Math.sign(uy || (cy < cur.y ? -1 : 1)) * speed;
  }
  if (ny <= minY || ny >= maxY) {
    ny = clampN(ny, minY, maxY);
    nx += Math.sign(ux || (cx < cur.x ? -1 : 1)) * speed;
  }
  beacon.setPosition(Math.round(clampN(nx, minX, maxX)), Math.round(clampN(ny, minY, maxY)), false);
}

// ===========================================================================
// QUICK-START PROMPT  — ⌥⌘Space to start a focus session by typing
// ===========================================================================
function ensurePrompt() {
  if (promptWin && !promptWin.isDestroyed()) return promptWin;
  promptWin = new BrowserWindow({
    width: 600,
    height: 64,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "prompt-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  promptWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  promptWin.loadFile(path.join(__dirname, "prompt.html"));
  // once loaded, apply whatever mode was requested
  promptWin.webContents.on("did-finish-load", () => promptWin && promptWin.webContents.send("prompt:mode", promptMode));
  promptWin.on("blur", () => promptWin && promptWin.hide());
  return promptWin;
}

// mode: "start" | "capture" | "rabbit" | "culture"
function showPrompt(mode = "start") {
  promptMode = mode;
  ensurePrompt();
  // push the mode over IPC (hash-only nav wouldn't re-run the renderer script)
  if (!promptWin.webContents.isLoading()) promptWin.webContents.send("prompt:mode", mode);
  const cur = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cur).workArea;
  const w = 600;
  promptWin.setBounds({
    x: Math.round(display.x + (display.width - w) / 2),
    y: Math.round(display.y + display.height * 0.28),
    width: w,
    height: 64,
  });
  promptWin.show();
  promptWin.focus();
}

// ===========================================================================
// OVERLOAD  — ⌥⌘O "I'm overwhelmed" → collapse the universe to one thing
// ===========================================================================
function ensureOverload() {
  if (overloadWin && !overloadWin.isDestroyed()) return overloadWin;
  overloadWin = new BrowserWindow({
    width: 480,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "overload-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overloadWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overloadWin.loadFile(path.join(__dirname, "overload.html"));
  overloadWin.on("blur", () => overloadWin && overloadWin.hide());
  return overloadWin;
}

async function showOverload() {
  ensureOverload();
  const cur = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(cur).workArea;
  overloadWin.setBounds({
    x: Math.round(wa.x + (wa.width - 480) / 2),
    y: Math.round(wa.y + (wa.height - 340) / 2),
    width: 480,
    height: 340,
  });
  overloadWin.show();
  overloadWin.focus();
  lastOverload = await httpGetJson("/api/overload");
  if (overloadWin && !overloadWin.isDestroyed()) overloadWin.webContents.send("overload:data", lastOverload);
}

// "DSA — binary trees 30"  ->  { label: "DSA — binary trees", minutes: 30 }
function parseFocus(text) {
  const t = text.trim();
  const m = t.match(/\s(\d{1,3})\s*(m|min|mins|minutes)?$/i);
  let minutes = 25;
  let label = t;
  if (m) {
    minutes = Math.min(600, Math.max(1, parseInt(m[1], 10)));
    label = t.slice(0, m.index).trim();
  }
  return { label: label || "Focus", minutes };
}

// ===========================================================================
// TRAY  — menu-bar presence + the NOW readout
// ===========================================================================
function shortLabel(s, n = 16) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function updateTray() {
  if (!tray) return;
  if (session.active && session.done) {
    tray.setTitle("  ✓ done");
  } else if (session.active && session.paused) {
    tray.setTitle(`  ⏸ ${shortLabel(session.label)}`);
  } else if (session.active) {
    tray.setTitle(`  ▸ ${shortLabel(session.label)}  ${fmtClock(remaining())}`);
  } else {
    tray.setTitle(""); // idle — icon only, stay out of the way
  }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const items = [];

  // ---- live panel: NOW / NEXT / set-aside counts ----
  items.push({ label: session.active ? `● NOW — ${shortLabel(session.label, 22)}${session.done ? " · done" : ` · ${fmtClock(remaining())}`}` : "○ Nothing running", enabled: false });
  if (traySummary.next) {
    const t = new Date(traySummary.next.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    items.push({ label: `NEXT — ${shortLabel(traySummary.next.label, 18)} at ${t}`, enabled: false });
  }
  if (traySummary.counts) {
    const c = traySummary.counts;
    items.push({ label: `Parked ${c.parked} · loops ${c.open} · todos ${c.todos}`, enabled: false });
  }
  items.push({ type: "separator" });

  if (session.active) {
    if (session.done) {
      items.push({ label: "Clear", click: () => finishSession() });
    } else {
      items.push({ label: session.paused ? "Resume" : "Pause", click: () => pauseSession() });
      items.push({ label: "Finish", click: () => finishSession() });
    }
    items.push({ type: "separator" });
  }
  items.push({ label: "Start focus…", accelerator: HOTKEYS.start, click: () => showPrompt("start") });
  items.push({ label: "Capture…", accelerator: HOTKEYS.capture, click: () => showPrompt("capture") });
  items.push({ label: "I'm overwhelmed", accelerator: HOTKEYS.overload, click: () => showOverload() });
  items.push({ label: "Reset — recover", click: () => showWindow("/reset") });
  items.push({
    label: beacon && beacon.isVisible() ? "Hide focus clock" : "Show focus clock",
    accelerator: HOTKEYS.beacon,
    click: () => toggleBeacon(),
  });
  items.push({ type: "separator" });
  items.push({ label: "Open HQ", click: () => showWindow() });
  LINKS.forEach((l) => items.push({ label: l.label, click: () => showWindow(l.route) }));
  items.push({ type: "separator" });
  items.push({
    label: "Quit HQ",
    accelerator: "Command+Q",
    click: () => {
      app.isQuitting = true;
      app.quit();
    },
  });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function buildTray() {
  // monochrome template image — macOS renders it black/white to match the menu bar
  let img = nativeImage.createFromPath(path.join(ASSETS, "tray-template.png"));
  img = img.resize({ height: 18, quality: "best" });
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip("HQ");
  // left-click just opens the menu; opening the app is one of the options ("Open HQ")
  rebuildTrayMenu();
  updateTray();
}

function buildAppMenu() {
  const template = [
    { role: "appMenu" },
    { label: "File", submenu: [{ label: "Close Window", accelerator: "Command+W", click: () => mainWindow && mainWindow.hide() }] },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "Command+R", click: () => mainWindow && mainWindow.webContents.reload() },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerShortcuts() {
  globalShortcut.register(HOTKEYS.start, () => showPrompt("start"));
  globalShortcut.register(HOTKEYS.capture, () => showPrompt("capture"));
  globalShortcut.register(HOTKEYS.rabbit, () => showPrompt("rabbit"));
  globalShortcut.register(HOTKEYS.overload, () => showOverload());
  globalShortcut.register(HOTKEYS.culture, () => showPrompt("culture"));
  globalShortcut.register(HOTKEYS.beacon, () => toggleBeacon());
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());

  app.whenReady().then(() => {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false });
    if (process.platform === "darwin" && app.dock) app.dock.setIcon(path.join(ASSETS, "icon.png"));

    createWindow();
    buildTray();
    buildAppMenu();
    ensureBeacon();
    beacon.show(); // the floating clock is visible by default
    registerShortcuts();

    // 1s tick drives the countdown, the menu-bar readout, and the beacon
    tickTimer = setInterval(() => {
      if (session.active && !session.paused && !session.done && remaining() <= 0) completeSession();
      // hyperfocus check-in — a single gentle nudge after 2h in one session (focus only)
      if (
        session.active &&
        !session.paused &&
        session.kind !== "CULTURE" &&
        !session.hyperNudged &&
        session.startMs &&
        Date.now() - session.startMs >= 120 * 60_000
      ) {
        session.hyperNudged = true;
        if (Notification.isSupported()) {
          const mins = Math.round((Date.now() - session.startMs) / 60_000);
          new Notification({ title: "Two hours in", body: `${session.label} — ${mins} min without a break. Keep going, or stand up for a minute?`, silent: true }).show();
        }
      }
      if (session.active) {
        updateTray();
        pushBeacon();
      }
    }, 1000);

    // ~60fps so the beacon glides away smoothly instead of snapping
    cursorTimer = setInterval(fleeCursor, 16);

    // adopt a session started from the web dashboard, and keep watching for one
    // while the beacon is idle (local sessions always win — no clobbering)
    apiGetNow().then(adoptNow);
    pollTimer = setInterval(() => {
      if (!session.active) apiGetNow().then(adoptNow);
    }, 8000);

    // scheduled-transition nudges + menu-bar panel refresh — every 30s
    pollReminders();
    refreshTraySummary();
    reminderTimer = setInterval(() => {
      pollReminders();
      refreshTraySummary();
    }, 30000);

    // Context Shield — check the frontmost app every 20s while focused
    shieldTimer = setInterval(checkShield, 20000);

    app.on("activate", () => showWindow());
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    if (tickTimer) clearInterval(tickTimer);
    if (cursorTimer) clearInterval(cursorTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (reminderTimer) clearInterval(reminderTimer);
    if (shieldTimer) clearInterval(shieldTimer);
  });

  app.on("window-all-closed", () => {});

  // prompt result — routed by mode
  ipcMain.on("prompt:submit", (_e, { mode, text }) => {
    const t = String(text || "").trim();
    if (t) {
      if (mode === "start") {
        const { label, minutes } = parseFocus(t);
        startSession(label, minutes, "FOCUS");
      } else if (mode === "culture") {
        const { label, minutes } = parseFocus(t);
        startSession(label, /\d/.test(t) ? minutes : 45, "CULTURE"); // leisure defaults to a longer, softer window
      } else if (mode === "rabbit") {
        httpPost("/api/capture", { text: t, kind: "RABBIT_HOLE" });
      } else {
        httpPost("/api/capture", { text: t });
      }
    }
    if (promptWin) promptWin.hide();
  });
  ipcMain.on("prompt:cancel", () => promptWin && promptWin.hide());

  // overload overlay actions
  ipcMain.on("overload:start", () => {
    const one = lastOverload && lastOverload.one;
    if (one && one.label) startSession(one.label, 25);
    if (overloadWin) overloadWin.hide();
  });
  ipcMain.on("overload:open", () => {
    if (overloadWin) overloadWin.hide();
    showWindow();
  });
  ipcMain.on("overload:close", () => overloadWin && overloadWin.hide());

  // transition overlay actions
  ipcMain.on("transition:start", () => {
    if (lastTransition) {
      startSession(lastTransition.label, 25, "FOCUS");
      httpPost("/api/schedule", { action: "status", id: lastTransition.id, status: "STARTED" });
    }
    if (transitionWin) transitionWin.hide();
  });
  ipcMain.on("transition:snooze", () => {
    if (lastTransition) httpPost("/api/schedule", { action: "snooze", id: lastTransition.id, minutes: 10 });
    if (transitionWin) transitionWin.hide();
  });
  ipcMain.on("transition:skip", () => {
    if (lastTransition) httpPost("/api/schedule", { action: "status", id: lastTransition.id, status: "SKIPPED" });
    if (transitionWin) transitionWin.hide();
  });
  ipcMain.on("transition:close", () => transitionWin && transitionWin.hide());

  ipcMain.handle("hq:navigate", (_e, route) => loadApp(route));
}
