// LinkedIn auto-apply loop (v1). Injected on the LinkedIn jobs page. Walks the
// job list, and for each Easy Apply job it opens the modal, fills every step from
// your HQ career profile, and by default stops on the final Submit so you click
// it yourself. External "Apply" jobs are skipped and counted.
//
// This is deliberately conservative: human-ish delays, a visible log, a Stop
// button, and it never clicks Submit unless you turn auto-submit on. LinkedIn
// renames its CSS a lot, so the selectors here are best-effort with fallbacks.
(() => {
  if (window.__HQ_AUTOAPPLY__) {
    window.__HQ_AUTOAPPLY_TOGGLE__ && window.__HQ_AUTOAPPLY_TOGGLE__();
    return;
  }
  window.__HQ_AUTOAPPLY__ = true;

  const DEFAULT_URL = "https://hq-three-mauve.vercel.app";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a)); // human-ish jitter
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const lc = (s) => clean(s).toLowerCase();

  let running = false;
  let stop = false;
  let profile = null;
  let cfg = { hqUrl: DEFAULT_URL, token: "" };
  const stats = { applied: 0, review: 0, skipped: 0, failed: 0 };

  // ---------- floating control panel ----------
  const panel = document.createElement("div");
  panel.id = "hq-autoapply-panel";
  panel.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;background:#12151b;color:#e7e3da;" +
    "border:1px solid #2a2f3a;border-radius:12px;font:12px/1.45 -apple-system,system-ui,sans-serif;" +
    "box-shadow:0 12px 40px rgba(0,0,0,.5);overflow:hidden";
  panel.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #2a2f3a">' +
    '<b style="font-size:12px">HQ Auto-apply</b>' +
    '<span id="hqaa-x" style="cursor:pointer;color:#9a958c">✕</span></div>' +
    '<div style="padding:12px;display:flex;flex-direction:column;gap:10px">' +
    '<label style="display:flex;align-items:center;gap:8px;color:#c9c4ba"><input type="checkbox" id="hqaa-submit"> auto-submit (off = stop at review)</label>' +
    '<div style="display:flex;gap:8px">' +
    '<button id="hqaa-go" style="flex:1;background:#dc9a58;color:#0f1115;border:0;border-radius:8px;padding:9px;font-weight:600;cursor:pointer">Start</button>' +
    '<button id="hqaa-stop" style="flex:1;background:transparent;color:#e2626b;border:1px solid #3a2a2e;border-radius:8px;padding:9px;font-weight:600;cursor:pointer">Stop</button>' +
    "</div>" +
    '<div id="hqaa-stat" style="color:#9a958c">idle</div>' +
    '<div id="hqaa-log" style="max-height:150px;overflow:auto;border-top:1px solid #2a2f3a;padding-top:8px;color:#9a958c;font-size:11px"></div>' +
    "</div>";
  document.body.appendChild(panel);

  // Don't let clicks on our panel bubble into LinkedIn's handlers, and if a
  // page re-render ever detaches the panel, put it right back. This keeps the
  // run alive when you click around the page during a wait.
  panel.addEventListener("mousedown", (e) => e.stopPropagation());
  panel.addEventListener("click", (e) => e.stopPropagation());
  try {
    const keepAlive = new MutationObserver(() => {
      if (!document.body.contains(panel)) document.body.appendChild(panel);
    });
    keepAlive.observe(document.body, { childList: true });
  } catch {
    /* observer unsupported — ignore */
  }

  const logEl = () => panel.querySelector("#hqaa-log");
  const statEl = () => panel.querySelector("#hqaa-stat");
  function log(msg) {
    const line = document.createElement("div");
    line.textContent = msg;
    logEl().prepend(line);
  }
  function stat() {
    statEl().textContent = `applied ${stats.applied} · review ${stats.review} · skipped ${stats.skipped} · failed ${stats.failed}`;
  }

  panel.querySelector("#hqaa-x").onclick = () => (panel.style.display = "none");
  window.__HQ_AUTOAPPLY_TOGGLE__ = () => (panel.style.display = panel.style.display === "none" ? "block" : "none");
  panel.querySelector("#hqaa-stop").onclick = () => {
    stop = true;
    log("stop requested, finishing current job…");
  };
  panel.querySelector("#hqaa-go").onclick = () => start();

  // ---------- profile + answer resolver ----------
  async function loadProfile() {
    cfg = { ...cfg, ...(await chrome.storage.local.get(["hqUrl", "token"])) };
    const base = (cfg.hqUrl || DEFAULT_URL).replace(/\/$/, "");
    const r = await fetch(base + "/api/career", { headers: { "x-hq-token": cfg.token } });
    if (!r.ok) throw new Error("HQ " + r.status);
    profile = (await r.json()).profile;
  }

  const digits = (s) => (s || "").replace(/[^\d]/g, "");
  const firstName = () => clean(profile.fullName).split(" ")[0] || "Pranshu";
  const lastName = () => clean(profile.fullName).split(" ").slice(1).join(" ") || "Pandey";

  // canned freeform answers, built from the profile
  function freeform(label) {
    const l = lc(label);
    const why =
      "I'm interning at Invsto and in my final year, so it's placement season. Instead of taking the default campus offer i'm looking for a stronger full-time role where i can do more meaningful, higher-impact engineering and commit fully as an engineer. I've been shipping production systems as an intern and want to do that end to end, full time.";
    if (/\brag\b/.test(l))
      return "Yes. At Invsto i build modular RAG pipelines end to end, chunking, embeddings, vector retrieval, re-ranking, and wiring retrieval into agent tool-calls, plus a RAG-based analysis pipeline in my P.R.A.N. project. For vector storage i've worked with FAISS and pgvector.";
    if (/(project).*(describe|example|built|proud)|(describe|example|built).*(project)/.test(l))
      return "EI-LMS, a full ERP/LMS i built and shipped for my college's Electronics & Instrumentation department (React, Express, PostgreSQL, Prisma). QR attendance, an online testing platform with automated evaluation, and automated reporting. I self-hosted it behind NGINX with PM2 and it serves 500+ daily users and 15,000+ requests/day. I owned the whole thing, schema to deployment.";
    if (/(why|interested|motivat|excite|passion|cover|join|attract)/.test(l)) return why;
    if (/(tell us|about yourself|introduce|describe you)/.test(l))
      return "Backend and AI engineer. I build asynchronous, event-driven systems and the agentic AI platforms that run on top of them, then ship them to production and keep them alive. At Invsto i took a latency-critical pipeline from ~27s to sub-second, and on my own i self-hosted an ERP/LMS serving 500+ daily users.";
    if (/(strength|why should we|why you|good fit|value)/.test(l)) return profile.pitch || why;
    return null;
  }

  // resolve a plain-text answer for a labelled field, or null if we can't
  function resolveText(label) {
    const l = lc(label);
    if (!l) return null;
    if (/preferred name|given name|nick ?name|goes by/.test(l)) return firstName();
    if (/first name|forename/.test(l)) return firstName();
    if (/last name|surname|family name/.test(l)) return lastName();
    if (/full name|^name$|your name|candidate name/.test(l)) return profile.fullName;
    if (/e-?mail/.test(l)) return profile.email;
    if (/country code/.test(l)) return "India (+91)";
    if (/phone|mobile|contact number|whatsapp/.test(l)) return digits(profile.phone).slice(-10);
    if (/linkedin/.test(l)) return profile.linkedin;
    if (/github/.test(l)) return profile.github;
    if (/portfolio|website|personal site|url/.test(l)) return profile.portfolio;
    if (/(pin ?code|postal|zip)/.test(l)) return "452003";
    if (/(current )?(city|location|based)/.test(l)) return "Indore, Madhya Pradesh, India";
    if (/state/.test(l)) return "Madhya Pradesh";
    if (/country/.test(l)) return "India";
    if (/address/.test(l)) return "Patnipura Road, Malwa Mill, Indore, Madhya Pradesh, India 452003";
    if (/current (employer|company|organi[sz]ation)/.test(l)) return profile.currentCompany;
    if (/current (title|role|designation)/.test(l)) return profile.currentTitle;
    // years of experience (generic + python)
    if (/(how many )?years? .*(experience|working|professional)|experience .*(years|in years)|total experience/.test(l)) return "3";
    if (/notice period/.test(l)) return profile.noticePeriod || "15";
    // salary / ctc — respect LPA vs absolute
    if (/(current).*(ctc|salary|compensation)/.test(l)) return /lpa|lakh|lpa/.test(l) ? "1.2" : "120000";
    if (/(expected|desired).*(ctc|salary|compensation)/.test(l)) return /lpa|lakh/.test(l) ? "12" : "1200000";
    if (/(ctc|salary|compensation)/.test(l)) return /lpa|lakh/.test(l) ? "12" : "1200000";
    return freeform(label);
  }

  // resolve a yes/no-ish answer for radios/selects with limited options
  function resolveChoice(label, options) {
    const l = lc(label);
    const opts = options.map((o) => ({ raw: o, l: lc(o) }));
    const pick = (val) => (opts.find((o) => o.l === lc(val) || o.l.includes(lc(val))) || {}).raw || null;
    // country code
    if (/country code/.test(l)) return pick("+91") || pick("india");
    // work authorization / sponsorship
    if (/(authorized|authori[sz]ation|eligible|legally).*(work|india)/.test(l)) {
      if (/us|u\.s|united states|uk|europe|canada/.test(l)) return pick("no");
      return pick("yes"); // authorized in India
    }
    if (/(require|need).*(sponsor|visa)/.test(l)) return pick("yes");
    if (/(relocat|willing to move|onsite|hybrid|work from office|open to)/.test(l)) return pick("yes");
    if (/(notice period)/.test(l)) return pick("15") || pick("immediate") || pick("less than");
    if (/gender/.test(l)) return pick("male");
    // "do you have experience with X / are you familiar with X"
    if (/(do you|have you|are you|experience|familiar|worked with|proficient|comfortable)/.test(l)) {
      const skills = lc(profile.skills + " " + profile.experience);
      // if the tech named in the question is in the skillset, say yes
      const named = l.match(/\b(python|javascript|typescript|react|next\.?js|fastapi|node|sql|postgres|redis|rabbitmq|docker|aws|azure|langchain|langgraph|rag|llm|mcp|agentic|genai|generative ai|ml|machine learning)\b/g);
      if (named && named.some((t) => skills.includes(t.replace(/\.?js/, "")))) return pick("yes");
      return pick("yes"); // default optimistic for capability questions
    }
    // years of experience as a dropdown
    if (/(years?).*(experience)/.test(l)) return pick("3") || pick("2") || pick("1");
    return null;
  }

  // ---------- native value setter (React-safe) ----------
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // find the human label for a control inside the modal
  function labelFor(el) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && clean(l.textContent)) return clean(l.textContent);
    }
    const lbId = el.getAttribute("aria-labelledby");
    if (lbId) {
      const txt = lbId
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => clean(n.textContent))
        .join(" ")
        .trim();
      if (txt) return txt;
    }
    const aria = el.getAttribute("aria-label");
    if (aria && !NOISE.test(aria)) return clean(aria);
    // generic climb (classes are hashed): find the nearest label/legend or the
    // sibling text block that reads like the question
    let n = el.parentElement;
    for (let i = 0; i < 5 && n; i++, n = n.parentElement) {
      const lab = n.querySelector("label, legend");
      if (lab && !lab.contains(el) && clean(lab.textContent) && !NOISE.test(clean(lab.textContent))) return clean(lab.textContent);
      const txt = [...n.children].find(
        (c) => c !== el && !c.contains(el) && clean(c.textContent).length > 3 && !NOISE.test(clean(c.textContent)) && !/^(input|select|textarea|button)$/i.test(c.tagName)
      );
      if (txt) return clean(txt.textContent).slice(0, 160);
    }
    // last resort: the nearest real label ABOVE the field in document order
    const prev = prevLabel(el);
    if (prev) return prev;
    return clean(el.placeholder || (NOISE.test(el.name || "") ? "" : el.name) || "");
  }

  // text that is decoration or a hashed group id, never a real question label
  const NOISE = /^[*₹@$₨€£+\s]+$|^\(\+?\d+\)$|^radio-group-|^(no results found|select an option|select|clear|browse|remove)$/i;
  function prevLabel(el) {
    try {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      w.currentNode = el;
      let node = w.previousNode();
      let hops = 0;
      while (node && hops < 200) {
        if (node !== el && !node.contains(el) && node.querySelectorAll("input, textarea, select, button").length === 0) {
          const t = clean(node.textContent);
          if (t && t.length < 120 && !NOISE.test(t)) return t;
        }
        node = w.previousNode();
        hops++;
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  // fill every visible control in the current modal step. returns {filled, missed[]}
  // set a value on any control type; returns true if it stuck
  function applyValue(el, value) {
    if (value == null || value === "") return false;
    const tag = el.tagName.toLowerCase();
    const type = (el.type || tag).toLowerCase();
    try {
      if (tag === "select") {
        const want = lc(value);
        const m =
          [...el.options].find((o) => lc(o.textContent) === want) ||
          [...el.options].find((o) => lc(o.textContent).includes(want) && want.length > 1) ||
          [...el.options].find((o) => want.includes(lc(o.textContent)) && clean(o.textContent).length > 1);
        if (m && !m.disabled) {
          el.value = m.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return false;
      }
      if (type === "radio") {
        const scope = el.closest("form") || document;
        const group = scope.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`);
        const want = lc(value);
        for (const r of group) {
          const rl = lc(labelFor(r) || r.value);
          if (rl && (rl.includes(want) || want.includes(rl))) {
            r.click();
            return true;
          }
        }
        return false;
      }
      if (type === "checkbox") {
        const should = /^(y|yes|true|1|agree|on)/i.test(String(value));
        if (el.checked !== should) el.click();
        return true;
      }
      // focus + set + blur so LinkedIn's React commits the value and runs its
      // validation (otherwise Next can stay armed while the field reads empty)
      try {
        el.focus();
      } catch {}
      setNativeValue(el, value);
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  // fill what we can from the profile; return the controls we couldn't (with refs)
  function fillStep(root) {
    const unfilled = [];
    let filled = 0;
    const seenRadio = new Set();
    for (const el of root.querySelectorAll("input, textarea, select")) {
      const type = (el.type || el.tagName).toLowerCase();
      if (["hidden", "submit", "button", "file"].includes(type)) continue;
      const label = labelFor(el);
      const required = /\*/.test(label) || el.required || el.getAttribute("aria-required") === "true";

      if (type === "checkbox") {
        if (!el.checked && /agree|consent|terms|privacy|confirm|certify|acknowledge/.test(lc(label))) {
          el.click();
          filled++;
        }
        continue;
      }
      if (type === "radio") {
        if (seenRadio.has(el.name)) continue;
        seenRadio.add(el.name);
        const group = [...root.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)];
        if (group.some((r) => r.checked)) continue;
        const options = group.map((r) => labelFor(r) || r.value);
        const want = resolveChoice(label, options);
        if (want && applyValue(el, want)) filled++;
        else unfilled.push({ el, label, type: "radio", options, required });
        continue;
      }
      if (el.tagName === "SELECT") {
        const options = [...el.options].map((o) => clean(o.textContent));
        const want = resolveChoice(label, options) || resolveText(label);
        if (want && applyValue(el, want)) filled++;
        else unfilled.push({ el, label, type: "select", options, required });
        continue;
      }
      // Textareas: LinkedIn caches the PREVIOUS job's answer here, so never trust
      // an existing value. Always send it (with its current text) to HQ, which
      // judges whether it fits this question and rewrites the whole field if not.
      if (el.tagName === "TEXTAREA") {
        unfilled.push({ el, label, type: "textarea", options: [], required, current: clean(el.value) });
        continue;
      }
      // Short inputs: a correct prefill (name/email/phone) is fine to keep.
      if (clean(el.value)) continue;
      const want = resolveText(label);
      if (want && applyValue(el, want)) filled++;
      else unfilled.push({ el, label, type, options: [], required, current: "" });
    }
    return { filled, unfilled };
  }

  // Ask HQ (the running Claude session) to answer the fields we couldn't map,
  // then drop the answers into the modal. Only required fields and freeform
  // textareas are sent; optional extras are left blank. This is what makes the
  // descriptive questions actually get answered.
  async function askHQ(unfilled) {
    // Ask HQ for anything we couldn't resolve locally that actually needs an
    // answer: required fields, freeform textareas, and ANY option question
    // (select/radio) — those are exactly the "pick the right one for me" cases.
    const ask = unfilled.filter((u) => u.required || u.type === "textarea" || u.type === "select" || u.type === "radio");
    if (!ask.length) return 0;
    const base = (cfg.hqUrl || DEFAULT_URL).replace(/\/$/, "");
    const fields = ask.map((u, i) => ({ key: "q" + i, label: u.label, type: u.type, options: u.options, current: u.current || "" }));
    let id;
    try {
      const r = await fetch(base + "/api/ext/fill", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hq-token": cfg.token },
        body: JSON.stringify({ action: "create", url: location.href, pageTitle: document.title, fields }),
      });
      id = (await r.json()).id;
    } catch (e) {
      log("  HQ post failed: " + (e.message || e));
      return 0;
    }
    log("  asked HQ " + ask.length + " question(s), waiting…");
    let answers = null;
    for (let i = 0; i < 120 && !stop; i++) {
      await sleep(2000);
      try {
        const r = await fetch(base + "/api/ext/fill?id=" + encodeURIComponent(id), { headers: { "x-hq-token": cfg.token } });
        const j = await r.json();
        if (j.job && j.job.status === "ANSWERED") {
          answers = j.job.answers;
          break;
        }
      } catch {}
    }
    if (!answers) {
      log("  HQ didn't answer in time (is the session + poller running?)");
      return 0;
    }
    let n = 0;
    ask.forEach((u, i) => {
      if (applyValue(u.el, answers["q" + i])) n++;
    });
    return n;
  }

  // ---------- modal stepping ----------
  // The Easy Apply modal is NOT a role=dialog in this build, and classes are
  // hashed. Two things inside it ARE stable: the footer action button
  // (Submit / Next / Review, by visible text) and the Dismiss "X". Their common
  // ancestor is the modal shell, valid on every step (including the field-less
  // review step). This also excludes the page's own Next/checkbox chrome, since
  // those don't share an ancestor with the modal's X.
  const ACTION_RE = /submit application|review your application|review application|^review$|^next$|continue to next step|^continue$/i;

  function actionButtons() {
    return [...document.querySelectorAll("button")].filter((b) => ACTION_RE.test(clean(b.getAttribute("aria-label") || b.textContent)));
  }

  // Strict: a real Easy Apply modal has BOTH a Dismiss "X" and a Submit/Next/
  // Review button sharing a low (non-body) ancestor. The post-submit "application
  // was sent" popup has an X but no such action button, so this returns null for
  // it — which is what lets the loop move on instead of waiting forever.
  function dialog() {
    const x = [...document.querySelectorAll("button")].find((b) => /^dismiss$/i.test(clean(b.getAttribute("aria-label") || b.textContent)));
    if (!x) return null;
    const anc = new Set();
    for (let n = x; n; n = n.parentElement) anc.add(n);
    for (const a of actionButtons()) {
      for (let m = a; m && m !== document.body && m !== document.documentElement; m = m.parentElement) {
        if (anc.has(m)) return m; // low common ancestor of X + action button = the modal
      }
    }
    return null;
  }

  function footerButton(root) {
    const btns = [...root.querySelectorAll("button")].filter((b) => !b.disabled);
    const by = (re) => btns.find((b) => re.test(clean(b.getAttribute("aria-label") || b.textContent)));
    return {
      submit: by(/submit application/i),
      review: by(/review your application|review application|^review$/i),
      next: by(/continue to next step|^next$|^continue$/i),
    };
  }

  function easyApplyButton() {
    const btns = [...document.querySelectorAll("button")].filter((b) => !b.disabled);
    return (
      btns.find((b) => /easy apply to/i.test(b.getAttribute("aria-label") || "")) ||
      btns.find((b) => /^easy apply$/i.test(clean(b.textContent)) && !/filter/i.test(b.getAttribute("aria-label") || ""))
    );
  }

  // the post-submit "application sent" popup — only act when that text is on
  // screen, and prefer "Not now" over the profile-upsell "Update profile"
  function dismissSentPopup() {
    if (!/application was sent|your application was sent/i.test(document.body.textContent)) return false;
    const by = (re) => [...document.querySelectorAll("button")].find((b) => re.test(clean(b.getAttribute("aria-label") || b.textContent)));
    const btn = by(/^not now$/i) || by(/^(done|no thanks|dismiss)$/i);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  async function runEasyApply(autoSubmit) {
    await sleep(rand(700, 1200));
    const openBtn = easyApplyButton();
    if (!openBtn) return "no-easy-apply";
    openBtn.click();
    // wait for the modal to appear — up to ~14s, so slow connections don't get skipped
    for (let i = 0; i < 28 && !dialog(); i++) {
      if (stop) return "stopped";
      await sleep(500);
    }
    if (!dialog()) return "no-modal";

    for (let step = 0; step < 25; step++) {
      if (stop) return "stopped";
      const d = dialog();
      if (!d) return "review-done"; // modal gone = submitted/closed
      const { filled, unfilled } = fillStep(d);
      let line = "step " + (step + 1) + ": filled " + filled;
      if (unfilled.length) {
        const got = await askHQ(unfilled);
        if (got) line += " · HQ answered " + got;
        const need = unfilled.filter((u) => (u.required || u.type === "textarea" || u.type === "select" || u.type === "radio") && !isAnswered(u)).map((u) => u.label);
        if (need.length) line += " · needs you → " + need.slice(0, 4).join(", ");
      }
      // let LinkedIn commit values + run validation before touching the footer
      await sleep(rand(800, 1200));
      // wait for a footer button to actually be READY (enabled), don't race it
      let b = footerButton(d);
      for (let k = 0; k < 12 && !(b.submit || b.review || b.next); k++) {
        if (stop) return "stopped";
        await sleep(350);
        b = footerButton(d);
      }
      log("  " + line);

      if (b.submit) {
        if (autoSubmit) {
          b.submit.click();
          await sleep(rand(1600, 2400));
          dismissSentPopup();
          return "applied";
        }
        b.submit.style.outline = "3px solid #dc9a58";
        b.submit.scrollIntoView({ block: "center" });
        log("  filled. review & click Submit (highlighted orange).");
        return await waitForUserSubmit();
      }

      const sig = stepSignature(d);
      const advance = b.review || b.next;
      if (advance) {
        advance.click();
        const r = await stepAdvanced(sig);
        if (r === "stopped") return "stopped";
        if (r === "advanced") continue; // moved on, keep auto-filling
        if (r === "closed") return "review-cancelled";
        // r === "same": Next did nothing — a choice you have to make yourself
      }

      // Can't move this step forward automatically. Stop clicking, hand it to you,
      // and resume the moment you advance to the next step (no more racing you).
      if (autoSubmit) return "stuck";
      log("  this step needs you (pick the right option) — go ahead, i'll continue when you move to the next step.");
      const res = await waitForUserStep(sig);
      if (res === "stopped") return "stopped";
      if (res === "advanced") continue; // you moved on → resume auto-fill
      if (res === "closed-sent") return "review-done";
      return "review-cancelled"; // closed without submitting, or timed out
    }
    return "too-many-steps";
  }

  // A fingerprint of the current modal step (its field labels + heading). It
  // changes when the modal moves to a different step, which is how we tell
  // whether a Next click actually advanced or the step just refused to move.
  function stepSignature(d) {
    if (!d) return "";
    const fields = [...d.querySelectorAll("input, select, textarea")].map((e) => labelFor(e)).join("|");
    const heading = clean(d.querySelector("h2, h3, [role=heading]")?.textContent || "");
    return heading + "::" + fields;
  }

  // is this unfilled control now answered (by HQ, or by you)?
  function isAnswered(u) {
    if (u.type === "radio") {
      const g = (u.el.closest("form") || document).querySelectorAll(`input[type=radio][name="${CSS.escape(u.el.name)}"]`);
      return [...g].some((r) => r.checked);
    }
    if (u.el.tagName === "SELECT") {
      const v = clean(u.el.selectedOptions[0]?.textContent || "");
      return v && !/^select( an option)?$/i.test(v);
    }
    return !!clean(u.el.value);
  }

  // after clicking Next, did the step actually change? (~4s)
  async function stepAdvanced(sig) {
    for (let i = 0; i < 12; i++) {
      if (stop) return "stopped";
      const d = dialog();
      if (!d) return "closed";
      if (stepSignature(d) !== sig) return "advanced";
      await sleep(350);
    }
    return "same";
  }

  // Hand a stuck step to you WITHOUT closing it. Resumes auto-fill the moment you
  // move to the next step, or finishes if you submit/close. Never clicks Next.
  async function waitForUserStep(sig) {
    const sentRe = /application was sent|your application was sent|application submitted/i;
    let gone = 0;
    for (let i = 0; i < 900; i++) {
      if (stop) return "stopped";
      if (sentRe.test(document.body.textContent)) {
        dismissSentPopup();
        return "closed-sent";
      }
      const d = dialog();
      if (!d) {
        if (++gone >= 3) {
          const sent = sentRe.test(document.body.textContent);
          dismissSentPopup();
          return sent ? "closed-sent" : "closed";
        }
      } else {
        gone = 0;
        if (stepSignature(d) !== sig) return "advanced"; // you moved to the next step
      }
      await sleep(1500);
    }
    return "timeout";
  }

  // Pause mode: wait while you review/edit and submit. ~22 min.
  //  • A real submit shows "application was sent / submitted" → logged as applied.
  //  • The modal must be GONE for a few seconds (not a one-frame re-render from an
  //    edit) before we call it closed, so editing no longer trips a false cancel.
  //  • Re-applies the Submit highlight if an edit made LinkedIn drop it.
  async function waitForUserSubmit() {
    const sentRe = /application was sent|your application was sent|application submitted/i;
    let gone = 0;
    for (let i = 0; i < 900; i++) {
      if (stop) return "stopped";
      if (sentRe.test(document.body.textContent)) {
        dismissSentPopup();
        return "review-done";
      }
      const d = dialog();
      if (d) {
        gone = 0;
        const b = footerButton(d);
        if (b.submit) b.submit.style.outline = "3px solid #dc9a58"; // survive re-renders
      } else if (++gone >= 3) {
        // ~4.5s with no modal = really closed, not an edit flicker
        for (let k = 0; k < 5 && !sentRe.test(document.body.textContent); k++) await sleep(400);
        const sent = sentRe.test(document.body.textContent);
        dismissSentPopup();
        return sent ? "review-done" : "review-cancelled";
      }
      await sleep(1500);
    }
    return "review-timeout";
  }

  // log a submitted application into HQ's Applications list
  async function logApplied(role, company) {
    const base = (cfg.hqUrl || DEFAULT_URL).replace(/\/$/, "");
    try {
      await fetch(base + "/api/ext/fill", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hq-token": cfg.token },
        body: JSON.stringify({ action: "apply", company: company || "Unknown", role: role || "Role", link: location.href, notes: "[auto-apply · LinkedIn Easy Apply]" }),
      });
    } catch (e) {
      log("  HQ log failed: " + (e.message || e));
    }
  }

  // ---------- job list iteration ----------
  // LinkedIn obfuscates every class name, so we DERIVE the job cards at runtime
  // instead of hardcoding selectors. A card is a role=button, tabindex=0 element
  // carrying a real chunk of text (title + company + location). We group the
  // candidates by their (hashed) class and take the biggest group — that's the
  // repeating card. Nothing here depends on a specific hash surviving a rebuild.
  function findCards(logCounts) {
    const btns = [...document.querySelectorAll('[role="button"][tabindex="0"], a[href*="/jobs/view/"]')];
    const groups = new Map();
    for (const b of btns) {
      if (clean(b.textContent).length < 20) continue; // skip tiny buttons (X, save, etc.)
      const key = (typeof b.className === "string" && b.className.split(" ")[0]) || b.tagName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    let best = [];
    for (const [, arr] of groups) if (arr.length >= 2 && arr.length > best.length) best = arr;
    if (!best.length) {
      const anchors = [...document.querySelectorAll('a[href*="/jobs/view/"]')];
      best = anchors.map((a) => a.closest('[role="button"]') || a);
    }
    if (logCounts) log("cards found: " + best.length);
    return best;
  }

  function cardId(card, i) {
    const aria = card.getAttribute("aria-label");
    if (aria) return aria.slice(0, 80);
    const t = clean(card.textContent).slice(0, 80);
    return t || "idx" + i;
  }

  // find the scrollable ancestor of a card so we can pull in virtualized rows
  function listScroller(card) {
    let n = card;
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 40) return n;
      n = n.parentElement;
    }
    return document.scrollingElement;
  }

  // Wait for the job detail pane to actually load, then say what it is. On slow
  // internet the pane shows skeletons for a bit; polling means we don't mistake a
  // still-loading Easy Apply job for an external one and skip it. Breaks early for
  // real external jobs the moment their "Apply" button shows up.
  async function classifyJob() {
    let loadedAt = -1;
    for (let i = 0; i < 40; i++) {
      // ~20s hard cap for genuinely slow connections
      if (stop) return "stopped";
      if (easyApplyButton()) return "easy";
      const ext = [...document.querySelectorAll("button, a")].find((el) => {
        const t = clean(el.textContent);
        return /^apply\b/i.test(t) && !/easy apply/i.test(t);
      });
      if (ext) return "external";
      // The header's Save/Saved button appears once the pane has actually loaded.
      // If it's there but no apply button is, the job is already applied to or its
      // application is managed off-LinkedIn — skip fast instead of waiting 15s.
      const loaded = [...document.querySelectorAll("button")].some((b) => /^saved?$/i.test(clean(b.getAttribute("aria-label") || b.textContent)));
      if (loaded) {
        if (loadedAt < 0) loadedAt = i;
        if (i - loadedAt >= 4) return "skip-loaded"; // ~2s grace after load for the apply button to show
      }
      await sleep(500);
    }
    return "external";
  }

  async function start() {
    if (running) return;
    running = true;
    stop = false;
    try {
      log("loading your profile…");
      await loadProfile();
      if (!cfg.token) {
        log("no token set — open the extension settings first");
        running = false;
        return;
      }
      const autoSubmit = panel.querySelector("#hqaa-submit").checked;
      log(autoSubmit ? "auto-submit ON" : "will stop at review");
      findCards(true); // log which selector matched
      const seen = new Set();
      let stagnant = 0;
      let idx = 0;

      // If a job is already open when you press Start, begin from THAT job instead
      // of re-walking the list from the top. We fast-forward (skip, no clicks) past
      // every card before the one whose title matches the open job.
      const openTitle = clean(document.querySelector("h1, .job-details-jobs-unified-top-card__job-title")?.textContent);
      let reached = !openTitle;
      if (openTitle) log("resuming from the open job: " + openTitle);

      // process the rendered cards, scroll to load more, repeat until the list
      // stops growing (LinkedIn virtualizes, so cards appear as you scroll)
      while (!stop && stagnant < 4) {
        const cards = findCards(false);
        let didNew = false;

        for (const card of cards) {
          if (stop) break;
          const id = cardId(card, idx);
          if (seen.has(id)) continue;
          seen.add(id);
          didNew = true;
          idx++;

          // fast-forward past everything before the job you had open
          if (!reached) {
            if (clean(card.textContent).toLowerCase().includes(openTitle.toLowerCase().slice(0, 40))) reached = true;
            else continue; // instant skip, no click
          }

          dismissSentPopup(); // clear any leftover "application sent" popup first
          card.scrollIntoView({ block: "center" });
          await sleep(rand(400, 800));
          card.click(); // the card itself is the role=button that selects the job in-pane
          await sleep(rand(900, 1400));

          const kind = await classifyJob(); // waits for the pane to load (slow-net safe)
          if (kind === "stopped") break;

          const title = clean(document.querySelector("h1, .job-details-jobs-unified-top-card__job-title")?.textContent) || "job " + idx;
          // tab title is "<role> | <company> | LinkedIn" — company is the middle bit
          const company =
            clean(document.title)
              .split("|")
              .map((s) => s.trim())
              .filter((s) => s && !/linkedin/i.test(s))[1] || "";

          if (kind === "external") {
            stats.skipped++;
            log("skip (external): " + title);
            stat();
            continue;
          }
          if (kind === "skip-loaded") {
            stats.skipped++;
            log("skip (already applied / off-LinkedIn): " + title);
            stat();
            continue;
          }

          log("apply: " + title + (company ? " @ " + company : ""));
          const outcome = await runEasyApply(autoSubmit);
          if (outcome === "applied" || outcome === "review-done") {
            stats.applied++;
            log(outcome === "applied" ? "  submitted ✓" : "  you submitted ✓");
            await logApplied(title, company); // add to HQ Applications
          } else if (outcome === "stopped") {
            break;
          } else if (outcome === "review-cancelled") {
            stats.skipped++;
            log("  cancelled — not logged");
          } else {
            // no-modal / closed-early / timeout — never auto-discard an application
            stats.failed++;
            log("  outcome: " + outcome + " (left as-is)");
          }
          stat();
          await sleep(rand(1500, 3000)); // breathe between jobs
        }

        if (!didNew) stagnant++;
        else stagnant = 0;

        // scroll the list to pull in more virtualized cards
        const nowCards = findCards(false);
        const last = nowCards.slice(-1)[0];
        if (last) {
          last.scrollIntoView({ block: "end" });
          const sc = listScroller(last);
          if (sc && sc.scrollBy) sc.scrollBy(0, 900);
        }
        await sleep(rand(800, 1300));
      }
      // Safety net: if the open job's card never matched a list row (e.g. odd
      // title), apply to it directly so pressing Start on it still does something.
      if (!reached && !stop && openTitle) {
        log("open job not found in the list — applying to it directly.");
        const kind = await classifyJob();
        if (kind === "easy") {
          const outcome = await runEasyApply(autoSubmit);
          if (outcome === "applied" || outcome === "review-done") {
            stats.applied++;
            const company = clean(document.title).split("|").map((s) => s.trim()).filter((s) => s && !/linkedin/i.test(s))[1] || "";
            await logApplied(openTitle, company);
            log("  submitted ✓");
          }
          stat();
        }
      }
      log(stop ? "stopped." : "done. processed this batch.");
    } catch (e) {
      log("error: " + (e.message || e));
    } finally {
      running = false;
    }
  }

  log("ready. pick auto-submit or leave it off, then Start.");
  stat();
})();
