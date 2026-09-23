// Injected on demand (only when you click the extension) into the active tab.
// Two jobs: scrape the page's fillable form fields, and later fill them with the
// answers HQ/Claude computes. It stamps each field with data-hqfill=<key> so the
// fill pass can find the exact same element back after the round-trip.
(() => {
  if (window.__HQ_FILL__) return; // guard against double-injection
  window.__HQ_FILL__ = true;

  let lastFields = []; // remembered from the last scrape, so fill can re-find a
  // field by its stable name attribute if the page re-rendered and dropped our
  // data-hqfill stamp (Lever/Zoho do this to their custom cards).

  const MAX_FIELDS = 200;

  const visible = (el) => {
    if (!el || el.disabled) return false;
    if (el.type === "hidden") return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, 200);

  // strip the cruft that clings to labels: leading "5. " numbering, trailing required
  // star, (required)/(optional), and character-count hints from textareas.
  const tidyLabel = (s) => {
    let t = clean(s);
    t = t.replace(/^\s*\d+[.)]\s*/, "");
    t = t.replace(/\s*[*✱]\s*$/, "");
    t = t.replace(/\s*\(\s*(required|optional)\s*\)\s*$/i, "");
    t = t.replace(/\s*\d+\s*characters?\s*(left|remaining|max)?\s*$/i, "");
    return t.trim();
  };
  // a label we should not trust: empty, too short, a bare number, or leaked option text.
  const looksWeak = (s) => {
    const t = clean(s);
    if (!t || t.length < 3) return true;
    if (/^\d+[.)]?$/.test(t)) return true;
    if (NOISE.test(t)) return true;
    if (/^(yes|no)$/i.test(t)) return true;
    return false;
  };

  // Hirist (and similar) wrap each question in a "*-question-container" div whose
  // first line is the numbered question heading ("5. How many years ... ?").
  // The generic label logic grabs a stray radio option instead, so read it directly.
  function containerQuestion(el) {
    try {
      const c = el.closest('[class*="question-container"], [class*="questionContainer"], [class*="question-item"], [class*="form-question"]');
      if (!c) return "";
      // Flatten the container (number, heading, options can be on separate lines),
      // drop the leading "5. " numbering, then take everything up to the first "?".
      let full = (c.innerText || c.textContent || "").replace(/\s+/g, " ").trim();
      if (!full) return "";
      full = full.replace(/^\s*\d+[.)]\s*/, "");
      const q = full.match(/^(.*?\?)/); // up to and including the first "?"
      let out = q ? q[1] : full;
      // if there was no "?", trim the answer-widget noise that follows the heading
      out = out.replace(/\b(Enter your answer|\d+\s*characters?\s*left|Yes\s+No)\b.*$/i, "").trim();
      return clean(out).slice(0, 200);
    } catch {
      return "";
    }
  }

  // best-effort human label for a control. Collects every candidate, tidies each,
  // and returns the first one that isn't weak (empty / bare number / leaked option).
  function labelFor(el) {
    const _t = (el.type || el.tagName || "").toLowerCase();
    const isOption = _t === "radio" || _t === "checkbox";
    // radios/checkboxes must return the OPTION text, not the question, so the
    // container-question lookup is only for text inputs / textareas.
    if (!isOption) {
      const cq = containerQuestion(el);
      if (!looksWeak(cq)) return tidyLabel(cq);
    }
    const cands = [];
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) cands.push(l.textContent);
    }
    const wrap = el.closest("label");
    if (wrap) cands.push(wrap.textContent);
    cands.push(el.getAttribute("aria-label"));
    const lb = el.getAttribute("aria-labelledby");
    if (lb) {
      const ref = document.getElementById(lb);
      if (ref) cands.push(ref.textContent);
    }
    // walk up looking for a nearby label-ish element
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      const cand = p.querySelector("label, .label, legend, [class*='label']");
      if (cand && !cand.contains(el)) cands.push(cand.textContent);
    }
    for (const c of cands) {
      const t = tidyLabel(c);
      if (!looksWeak(t)) return t;
    }
    // Zoho/Lever put the label as a separate block ABOVE the input, so walk backwards
    // in document order for the nearest real label; then retry the container.
    const prev = tidyLabel(prevLabel(el));
    if (!looksWeak(prev)) return prev;
    if (!isOption) {
      const cq2 = containerQuestion(el);
      if (!looksWeak(cq2)) return tidyLabel(cq2);
    }
    return tidyLabel(el.placeholder || el.name || el.getAttribute("aria-describedby") || "");
  }

  const NOISE = /^[*✱₹@$₨€£+\s]+$|^\(\+?\d+\)$|^(no results found|select an option|select|clear|browse|remove)$/i;
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

  function scrape() {
    const fields = [];
    const radioGroups = {};
    let n = 0;
    const stamp = (el) => {
      const key = "f" + n++;
      el.setAttribute("data-hqfill", key);
      return key;
    };

    const controls = document.querySelectorAll("input, textarea, select");
    for (const el of controls) {
      if (fields.length >= MAX_FIELDS) break;
      const tag = el.tagName.toLowerCase();
      const type = (el.type || tag).toLowerCase();
      if (["hidden", "submit", "button", "reset", "image", "file", "password"].includes(type)) continue;
      if (!visible(el)) continue;

      if (type === "radio") {
        const name = el.name || labelFor(el);
        if (!radioGroups[name]) {
          radioGroups[name] = { key: stamp(el), label: containerQuestion(el) || labelFor(el) || name, type: "radio", name, options: [], required: el.required };
          fields.push(radioGroups[name]);
        } else {
          el.setAttribute("data-hqfill", radioGroups[name].key); // share the group's key
        }
        const optLabel = labelFor(el) || el.value;
        radioGroups[name].options.push(clean(optLabel) || clean(el.value));
        continue;
      }

      const key = stamp(el);
      const f = { key, label: labelFor(el), type, name: el.name || el.id || "", required: !!el.required, current: clean(el.value) };
      if (tag === "select") f.options = [...el.options].map((o) => clean(o.textContent) || clean(o.value)).filter(Boolean).slice(0, 60);
      if (type === "checkbox") f.current = el.checked ? "checked" : "";
      fields.push(f);
    }
    // Carry the job description along as a synthetic field so HQ/Claude can tailor a
    // resume to it. It has no real element, so the fill pass never touches it (nothing
    // is ever answered for the "__jd" key).
    const jd = getPageText();
    if (jd) fields.push({ key: "__jd", label: "__JOB_DESCRIPTION__", type: "meta", name: "", required: false, current: jd });
    lastFields = fields;
    return { ok: true, url: location.href, title: document.title, fields };
  }

  // Grab the job-description text so HQ/Claude can tailor a resume to it, not just fill
  // fields. Prefer the main content region; fall back to the whole body. Capped.
  function getPageText() {
    try {
      const cand = document.querySelector(
        'main, article, [role="main"], [class*="job-description"], [class*="jobDescription"], [class*="description"]'
      );
      let txt = (cand && cand.innerText) || document.body.innerText || "";
      txt = txt.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      return txt.slice(0, 12000);
    } catch {
      return "";
    }
  }

  // React/Vue-safe value setter — bypasses the framework's cached value so the
  // input event fires with the new value and the component's state updates.
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    try {
      el.focus();
    } catch {}
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  const truthy = (v) => /^(y|yes|true|1|on|checked|agree)/i.test(String(v).trim());

  function fill(answers) {
    let filled = 0;
    for (const [key, raw] of Object.entries(answers || {})) {
      const value = String(raw ?? "");
      let el = document.querySelector(`[data-hqfill="${CSS.escape(key)}"]`);
      // re-render dropped our stamp? re-find by the field's stable name attribute
      if (!el) {
        const f = lastFields.find((x) => x.key === key);
        if (f && f.name) el = document.querySelector(`[name="${CSS.escape(f.name)}"]`);
      }
      if (!el || !value) continue;
      const tag = el.tagName.toLowerCase();
      const type = (el.type || tag).toLowerCase();
      try {
        if (tag === "select") {
          const opts = [...el.options];
          const want = value.toLowerCase();
          let match =
            opts.find((o) => (o.textContent || "").trim().toLowerCase() === want || (o.value || "").toLowerCase() === want) ||
            opts.find((o) => (o.textContent || "").trim().toLowerCase().includes(want) && want.length > 1) ||
            opts.find((o) => want.includes((o.textContent || "").trim().toLowerCase()) && (o.textContent || "").trim().length > 1);
          if (match) {
            el.value = match.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            filled++;
          }
        } else if (type === "radio") {
          const group = document.querySelectorAll(`[data-hqfill="${CSS.escape(key)}"]`);
          const want = value.toLowerCase();
          for (const r of group) {
            const lab = (labelFor(r) || r.value || "").toLowerCase();
            if (lab === want || lab.includes(want) || want.includes(lab)) {
              r.click();
              filled++;
              break;
            }
          }
        } else if (type === "checkbox") {
          const should = truthy(value);
          if (el.checked !== should) el.click();
          filled++;
        } else {
          setNativeValue(el, value);
          filled++;
        }
      } catch {
        /* skip a field that won't cooperate */
      }
    }
    return { ok: true, filled };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg?.type === "HQ_SCRAPE") sendResponse(scrape());
      else if (msg?.type === "HQ_FILL") sendResponse(fill(msg.answers));
      else sendResponse({ ok: false, error: "unknown" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  });
})();
