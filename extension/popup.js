// Popup flow:
//   scrape active tab → POST create job → poll until Claude answers → fill DOM →
//   let you save it to HQ's Applied list. All HQ calls carry the x-hq-token.
const DEFAULT_URL = "https://hq-three-mauve.vercel.app";

const $ = (id) => document.getElementById(id);
let cfg = { hqUrl: DEFAULT_URL, token: "" };
let tab = null;
let jobId = null;

function setStatus(msg, cls = "") {
  const el = $("status");
  el.className = "status " + cls;
  el.innerHTML = msg;
}

async function api(path, opts = {}) {
  const res = await fetch(cfg.hqUrl.replace(/\/$/, "") + path, {
    ...opts,
    headers: { "content-type": "application/json", "x-hq-token": cfg.token, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error("HQ " + res.status);
  return res.json();
}

const sendToTab = (message) =>
  new Promise((resolve) => chrome.tabs.sendMessage(tab.id, message, (r) => resolve(chrome.runtime.lastError ? null : r)));

async function ensureInjected() {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return true;
  } catch (e) {
    setStatus("Can't run on this page (try an actual application form).", "err");
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doFill() {
  $("fill").disabled = true;
  $("save").style.display = "none";
  $("note").style.display = "none";
  try {
    setStatus("Reading the form…");
    if (!(await ensureInjected())) return;
    const scraped = await sendToTab({ type: "HQ_SCRAPE" });
    if (!scraped || !scraped.ok) return setStatus("Couldn't read the page. Reload it and retry.", "err");
    if (!scraped.fields.length) return setStatus("No fillable fields found on this page.", "err");

    setStatus(`<span class="spin"></span>Sent ${scraped.fields.length} fields — waiting for HQ…`);
    const { id } = await api("/api/ext/fill", {
      method: "POST",
      body: JSON.stringify({ action: "create", url: scraped.url, pageTitle: scraped.title, fields: scraped.fields }),
    });
    jobId = id;

    // poll until Claude answers (up to ~5 min — tolerates monitor re-arm gaps)
    let job = null;
    for (let i = 0; i < 150; i++) {
      await sleep(2000);
      const r = await api("/api/ext/fill?id=" + encodeURIComponent(id));
      job = r.job;
      if (job && job.status === "ANSWERED") break;
      if (job && (job.status === "CANCELLED" || job.status === "APPLIED")) break;
      setStatus(`<span class="spin"></span>Waiting for HQ to fill… (${(i + 1) * 2}s)`);
    }
    if (job && job.status === "CANCELLED") {
      const why = job.note ? " " + job.note : " (no fillable form here — open the actual apply page.)";
      if (job.note) { $("note").textContent = job.note; $("note").style.display = "block"; }
      return setStatus("HQ skipped this one." + why, "err");
    }
    if (job && job.status === "APPLIED") return setStatus("This one's already logged as Applied in HQ.", "ok");
    if (!job || job.status !== "ANSWERED") return setStatus("HQ didn't answer in time. Is the session running?", "err");

    const res = await sendToTab({ type: "HQ_FILL", answers: job.answers });
    const n = res && res.filled != null ? res.filled : 0;
    setStatus(`Filled ${n} field${n === 1 ? "" : "s"}. Review, then submit on the site.`, "ok");

    if (job.note) {
      $("note").textContent = job.note;
      $("note").style.display = "block";
    }
    $("company").value = job.company || "";
    $("role").value = job.role || "";
    $("save").style.display = "flex";
  } catch (e) {
    setStatus("Error: " + e.message + (String(e.message).includes("401") ? " — check your token." : ""), "err");
  } finally {
    $("fill").disabled = false;
  }
}

async function doAutoApply() {
  if (!/linkedin\.com/.test(tab.url || "")) {
    setStatus("Open your LinkedIn Jobs page first, then click this.", "err");
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["autoapply.js"] });
    setStatus("Auto-apply panel is open on the page, bottom-right.", "ok");
    setTimeout(() => window.close(), 800);
  } catch (e) {
    setStatus("Couldn't start: " + e.message, "err");
  }
}

async function doApply() {
  $("apply").disabled = true;
  try {
    setStatus("Saving to Applied…");
    await api("/api/ext/fill", {
      method: "POST",
      body: JSON.stringify({
        action: "apply",
        id: jobId,
        company: $("company").value.trim(),
        role: $("role").value.trim(),
        link: tab.url,
      }),
    });
    setStatus("Saved to Applied ✓", "ok");
    $("save").style.display = "none";
  } catch (e) {
    setStatus("Couldn't save: " + e.message, "err");
  } finally {
    $("apply").disabled = false;
  }
}

async function init() {
  cfg = { ...cfg, ...(await chrome.storage.local.get(["hqUrl", "token"])) };
  if (!cfg.hqUrl) cfg.hqUrl = DEFAULT_URL;
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    $("site").textContent = new URL(tab.url).hostname;
  } catch {}

  if (!cfg.token) {
    $("setup").style.display = "block";
    $("openOptions").onclick = () => chrome.runtime.openOptionsPage();
    return;
  }
  $("main").style.display = "flex";
  $("autoapply").onclick = doAutoApply;
  $("fill").onclick = doFill;
  $("apply").onclick = doApply;
}

init();
