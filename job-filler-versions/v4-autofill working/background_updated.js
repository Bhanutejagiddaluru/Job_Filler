// problem is Alt+2 filling the check boxes only, where i need to manually click on the press the button


// background.js — MV3
// Alt+2 => "fill-fixed": fill by matching QUESTION TEXT on the page (your robust logic)

// OPTIONAL: nudge user once to set the shortcut for unpacked installs
chrome.runtime.onInstalled.addListener(() => maybePromptShortcut());
chrome.runtime.onStartup.addListener(() => maybePromptShortcut());

async function maybePromptShortcut() {
  try {
    const cmds = await chrome.commands.getAll();
    const cmd = cmds.find(c => c.name === "fill-fixed");
    if (!cmd || !cmd.shortcut) {
      await chrome.action.setBadgeText({ text: "SET" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); } catch {}
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
  } catch {}
}

// Hotkey handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-fixed") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Pull ONLY the compliance values you want to auto-answer
  const data = await chrome.storage.local.get([
    // Your six compliance answers stored from popup
    "workAuthUS",         // "Yes" | "No"
    "legalWorkCountry",   // "Yes" | "No"
    "ageCategory",        // "18 years of age and Over" | "Under 18"
    "provideAuth3Days",   // "Yes" | "No"
    "needSponsorship",    // "Yes" | "No"
    "meetsMinQuals"       // "Yes" | "No"
  ]);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: injectedAutofill,
    args: [data]
  });
});

// =============== Injected page logic (based on your robust example) ===============
function injectedAutofill(saved) {
  (async function () {

    // ================== DATA ==================
    // Build QA from your saved popup answers.
    // Each item is [arrayOfQuestionPhrases, answerText]
    const QA = [];

    // helper to push only if we have a value
    const push = (needles, answer) => { if (answer) QA.push([needles, answer]); };

    push([
      "are you currently authorized to work in the united states",
      "work authorization in the united states",
      "us work authorization",
      "eligible to work in the united states",
      "authorized to work in the u.s."
    ], saved.workAuthUS);

    push([
      "are you legally able to work in the country where this job is located",
      "legally able to work in this country",
      "work in the country where this job is located",
      "work in this country"
    ], saved.legalWorkCountry);

    push([
      "please select your age category",
      "age category",
      "years of age",
      "18 years of age and over"
    ], saved.ageCategory);

    push([
      "are you able to provide work authorization within 3 days of your hire",
      "provide work authorization within 3 days",
      "i-9 within 3 days"
    ], saved.provideAuth3Days);

    push([
      "will you now or in the future require sponsorship to work within the united states",
      "will you now or in the future require sponsorship",
      "require sponsorship",
      "future sponsorship"
    ], saved.needSponsorship);

    push([
      "do you certify you meet all minimum qualifications for this job",
      "meet all minimum qualifications",
      "minimum qualifications"
    ], saved.meetsMinQuals);

    // ================== HELPERS ==================
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const toL = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const inNav = (el) => !!el?.closest?.('header, nav, [role="navigation"], [role="banner"], .nav, .navbar');

    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };

    function* walkAllNodes(root = document) {
      yield root;
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let n = root;
      while ((n = tw.nextNode())) {
        yield n;
        if (n.shadowRoot) yield* walkAllNodes(n.shadowRoot);
      }
    }
    function queryAllDeep(selector, root = document) {
      const out = [];
      for (const n of walkAllNodes(root)) {
        try { if (n.matches?.(selector)) out.push(n); } catch {}
        try { n.querySelectorAll?.(selector)?.forEach(x => out.push(x)); } catch {}
      }
      return Array.from(new Set(out)).filter(visible);
    }

    function realClick(el) {
      if (!el) return;
      ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
      );
    }

    function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function wordBoundaryHas(hay, needle){
      const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:$|[^a-z0-9])`, "i");
      return re.test(hay);
    }

    function isYesText(s) { const t = toL(s); return t === "yes" || t === "y" || t.startsWith("yes"); }
    function isNoText(s)  { const t = toL(s); return t === "no"  || t === "n" || t.startsWith("no"); }
    function isGenderToken(s){
      const t = toL(s);
      return t === "male" || t === "female" || t === "man" || t === "woman" ||
             t === "non-binary" || t === "nonbinary" || t === "other" ||
             t === "prefer not to say" || t === "prefer not to answer";
    }
    function matchesAnswer(text, target) {
      const a = toL(text), b = toL(target);
      if (isGenderToken(b)) return wordBoundaryHas(a, b);
      if (isYesText(b)) return isYesText(a);
      if (isNoText(b))  return isNoText(a);
      return a === b || a.includes(b) || b.includes(a);
    }

    function countCandidateControls() {
      return queryAllDeep(`
        select,
        input[type="radio"],
        input[type="checkbox"],
        [role="combobox"],
        [aria-haspopup="listbox"],
        [role="radiogroup"],
        [data-automation-id="selectBox"],
        [data-automation-id="select-selectedOption"]
      `).filter(el => !inNav(el)).length;
    }

    const PAGE_TXT = toL(document.body?.innerText || document.body?.textContent || "");
    const pageHasAnyNeedle = (needles) => needles.some(n => PAGE_TXT.includes(toL(n)));

    async function waitForContainer(needles, timeoutMs = 5000) {
      const start = performance.now();
      while (performance.now() - start < timeoutMs) {
        const c = findContainerStrict(needles);
        if (c) return c;
        await sleep(150);
      }
      return null;
    }

    function findContainerStrict(needles) {
      const candidates = queryAllDeep('fieldset, section, div, li, [role="group"], [role="radiogroup"], [data-automation-id]');
      let best = null, bestScore = -1;

      for (const el of candidates) {
        const text = toL(el.textContent || "");
        if (!needles.some(n => text.includes(toL(n)))) continue;
        if (inNav(el)) continue;

        const hasControl = !!el.querySelector(
          'select, input[type="radio"], input[type="checkbox"], [role="combobox"], [aria-haspopup="listbox"], [data-automation-id="selectBox"], [data-automation-id="select-selectedOption"]'
        );

        const rect = el.getBoundingClientRect();
        const areaScore = rect ? Math.max(0, 200000 - (rect.width * rect.height)) / 50000 : 0;

        const score =
          (hasControl ? 10 : 0) +
          (el.tagName === "FIELDSET" ? 3 : /SECTION|DIV|LI/.test(el.tagName) ? 2 : 1) +
          areaScore;

        if (score > bestScore) { best = el; bestScore = score; }
      }
      return best;
    }

    function readSelectedText(container) {
      const a = queryAllDeep('[data-automation-id="select-selectedOption"]', container)[0];
      if (a?.textContent) return a.textContent.trim();

      const b = queryAllDeep('[data-automation-id="select-selectedOptionLabel"]', container)[0];
      if (b?.textContent) return b.textContent.trim();

      const sel = queryAllDeep('select', container)[0];
      if (sel && sel.selectedIndex >= 0) {
        const opt = sel.options[sel.selectedIndex];
        if (opt) return (opt.text || opt.value || "").trim();
      }

      const checked = queryAllDeep('input[type="radio"]:checked, input[type="checkbox"]:checked', container)[0];
      if (checked) {
        let labelText = "";
        if (checked.id) {
          const lab = container.querySelector(`label[for="${CSS.escape(checked.id)}"]`);
          if (lab?.textContent) labelText = lab.textContent.trim();
        }
        if (!labelText) {
          const lab = checked.closest('label');
          if (lab?.textContent) labelText = lab.textContent.trim();
        }
        return labelText || "checked";
      }
      return "";
    }

    function setNativeSelect(container, targetText) {
      const sel = queryAllDeep('select', container)[0];
      if (!sel) return false;
      let idx = -1;
      for (let i = 0; i < sel.options.length; i++) {
        const t = (sel.options[i].text || sel.options[i].value || "").trim();
        if (matchesAnswer(t, targetText)) { idx = i; break; }
      }
      if (idx === -1) return false;
      sel.selectedIndex = idx;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    function setRadioOrCheckbox(container, targetText) {
      const radios = queryAllDeep('input[type="radio"]', container);
      if (radios.length) {
        for (const r of radios) {
          let txt = "";
          if (r.id) {
            const lab = container.querySelector(`label[for="${CSS.escape(r.id)}"]`);
            if (lab?.textContent) txt = lab.textContent.trim();
          }
          if (!txt) {
            const lab = r.closest('label');
            if (lab?.textContent) txt = lab.textContent.trim();
          }
          if (matchesAnswer(txt, targetText)) {
            if (!r.checked) { r.scrollIntoView({ block: "center" }); realClick(r); r.dispatchEvent(new Event("change", { bubbles: true })); }
            return true;
          }
        }
      }
      const checks = queryAllDeep('input[type="checkbox"]', container);
      for (const c of checks) {
        let txt = "";
        if (c.id) {
          const lab = container.querySelector(`label[for="${CSS.escape(c.id)}"]`);
          if (lab?.textContent) txt = lab.textContent.trim();
        }
        if (!txt) {
          const lab = c.closest('label');
          if (lab?.textContent) txt = lab.textContent.trim();
        }
        if (matchesAnswer(txt, targetText)) {
          if (!c.checked) { c.scrollIntoView({ block: "center" }); realClick(c); c.dispatchEvent(new Event("change", { bubbles: true })); }
          return true;
        }
      }
      return false;
    }

    function openDropdown(container) {
      const triggers = [
        ...queryAllDeep('[data-automation-id="selectBox"]', container),
        ...queryAllDeep('[data-automation-id="select-selectedOption"]', container),
        ...queryAllDeep('button[aria-haspopup="listbox"]', container),
        ...queryAllDeep('[aria-haspopup="listbox"]', container),
        ...queryAllDeep('[role="combobox"]', container),
        ...queryAllDeep('select', container),
      ].filter(t => !inNav(t));

      const trigger = triggers[0] || null;
      if (!trigger || !visible(trigger)) return null;
      trigger.scrollIntoView({ block: "center" });
      trigger.focus?.();
      realClick(trigger);
      return trigger;
    }

    function clickTargetFromOpenList(trigger, targetText) {
      const tRect = trigger.getBoundingClientRect();
      const tCx = tRect.left + tRect.width / 2;
      const tCy = tRect.top + tRect.height / 2;

      const options = queryAllDeep('[data-automation-id="select-option"], [role="option"]', document);
      const candidates = options
        .map(o => {
          const r = o.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dist = Math.hypot(cx - tCx, cy - tCy);
          return { o, dist, text: (o.textContent || "").trim() };
        })
        .filter(x => matchesAnswer(x.text, targetText))
        .sort((a, b) => a.dist - b.dist);

      if (!candidates.length) return false;
      const optEl = candidates[0].o.closest('[role="option"], [data-automation-id="select-option"]') || candidates[0].o;
      optEl.scrollIntoView({ block: "center" });
      realClick(optEl);
      return true;
    }

    async function typeThenEnter(targetText) {
      const el = document.activeElement;
      if (!el) return false;
      const role = el.getAttribute("role");
      const isEditable = role === "combobox" || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
      if (!isEditable) return false;

      el.focus();
      if ("value" in el) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.value = targetText;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await sleep(80);
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      await sleep(140);
      return true;
    }

    async function chooseValue(container, targetText) {
      try {
        if (setNativeSelect(container, targetText)) { await sleep(100); return matchesAnswer(readSelectedText(container), targetText); }
        if (setRadioOrCheckbox(container, targetText)) { await sleep(100); return matchesAnswer(readSelectedText(container), targetText); }

        const trigger = openDropdown(container);
        if (!trigger) return false;
        await sleep(160);

        let acted = clickTargetFromOpenList(trigger, targetText);
        if (!acted) { await sleep(180); acted = clickTargetFromOpenList(trigger, targetText); }
        if (!acted) { acted = await typeThenEnter(targetText); }

        if (acted) {
          await sleep(160);
          trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
          trigger.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
        }

        await sleep(220);
        let v = readSelectedText(container);
        if (matchesAnswer(v, targetText)) return true;

        // one retry
        realClick(trigger);
        await sleep(160);
        clickTargetFromOpenList(trigger, targetText);
        await sleep(200);
        v = readSelectedText(container);
        return matchesAnswer(v, targetText);
      } catch (e) {
        console.warn("chooseValue error:", e);
        return false;
      }
    }

    function toast(text, ok=true) {
      if (window.top !== window) return;
      try {
        const id = "autofill_toast";
        document.getElementById(id)?.remove();
        const t = document.createElement("div");
        t.id = id; t.textContent = text;
        Object.assign(t.style, {
          position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
          background: ok ? "#0f766e" : "#b91c1c", color: "#fff", padding: "8px 12px",
          borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
        });
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2400);
      } catch {}
    }

    // ================== MAIN ==================

    if (QA.length === 0) { toast("No saved answers to fill.", false); return; }

    // Bail-out if page clearly has nothing
    const hasControls = countCandidateControls() > 0;
    const anyNeedleOnPage = QA.some(([needles]) => pageHasAnyNeedle(needles));
    if (!hasControls && !anyNeedleOnPage) { toast("No matching questions/controls on this page — exiting.", false); return; }

    const results = [];
    for (const [needles, ans] of QA) {
      if (!pageHasAnyNeedle(needles)) { results.push(`${needles[0].slice(0, 22)}… —`); continue; }

      const c = await waitForContainer(needles, 5000);
      if (!c) { results.push(`${needles[0].slice(0, 22)}… ✗`); continue; }

      c.scrollIntoView({ block: "center" });
      await sleep(80);

      const ok = await chooseValue(c, ans);
      results.push(`${needles[0].slice(0, 22)}… ${ok ? "✓" : "✗"}`);
      await sleep(140);
    }

    toast(results.join("  "));
  })().catch(err => {
    try {
      const id = "autofill_toast_err";
      document.getElementById(id)?.remove();
      const t = document.createElement("div");
      t.id = id; t.textContent = "Autofill error: " + (err?.message || err);
      Object.assign(t.style, {
        position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
        background: "#b91c1c", color: "#fff", padding: "8px 12px",
        borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
      });
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3500);
    } catch {}
    console.warn("Injected autofill crashed:", err);
  });
}






// some random code

/** 
 * // ---- Shortcut helper: nudge user to set Alt+2 once for unpacked extensions ----
async function needsShortcut() {
  const cmds = await chrome.commands.getAll();
  const cmd = cmds.find(c => c.name === "fill-form");
  return !cmd || !cmd.shortcut;
}

async function promptForShortcut() {
  await chrome.action.setBadgeText({ text: "SET" });
  await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" }); // red
  try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); } catch {}
}

async function clearBadgeIfReady() {
  if (!(await needsShortcut())) await chrome.action.setBadgeText({ text: "" });
}

chrome.runtime.onInstalled.addListener(async () => {
  if (await needsShortcut()) await promptForShortcut();
  else await clearBadgeIfReady();
});
chrome.runtime.onStartup.addListener(async () => {
  if (await needsShortcut()) await promptForShortcut();
  else await clearBadgeIfReady();
});

// ---- Injected page filler: text + radios/checkboxes/selects/comboboxes ----
function pageFillFn(data) {
  // ================== helpers ==================
  const toL = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const inNav = (el) => !!el?.closest?.('header, nav, [role="navigation"], [role="banner"], .nav, .navbar');

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };

  function* walkAllNodes(root = document) {
    yield root;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = root;
    while ((n = tw.nextNode())) {
      yield n;
      if (n.shadowRoot) yield* walkAllNodes(n.shadowRoot);
    }
  }
  function queryAllDeep(selector, root = document) {
    const out = [];
    for (const n of walkAllNodes(root)) {
      try { if (n.matches?.(selector)) out.push(n); } catch {}
      try { n.querySelectorAll?.(selector)?.forEach(x => out.push(x)); } catch {}
    }
    return Array.from(new Set(out)).filter(visible);
  }

  // React/Angular/Vue change-safe value set
  const setReactSafe = (el, value) => {
    if (!el) return;
    const proto = el.__proto__ || Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = desc && desc.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // Rich click for frameworks
  function realClick(el) {
    if (!el) return;
    ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    );
  }

  // Matching helpers (avoid "female" matching "male")
  function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function wordBoundaryHas(hay, needle){
    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:$|[^a-z0-9])`, "i");
    return re.test(hay);
  }
  function isGenderToken(s){
    const t = toL(s);
    return t === "male" || t === "female" || t === "man" || t === "woman" ||
           t === "non-binary" || t === "nonbinary" || t === "other" ||
           t === "prefer not to say" || t === "prefer not to answer";
  }
  function isYesText(s){ const t = toL(s); return t === "yes" || t === "y" || t.startsWith("yes"); }
  function isNoText(s){  const t = toL(s); return t === "no"  || t === "n" || t.startsWith("no"); }

  function matchesAnswer(text, target) {
    const a = toL(text), b = toL(target);
    if (!b) return false;
    if (isGenderToken(b)) return wordBoundaryHas(a, b);
    if (isYesText(b)) return isYesText(a);
    if (isNoText(b))  return isNoText(a);
    return a === b || a.includes(b) || b.includes(a);
  }

  // Tiny toast
  function toast(text, ok=true) {
    if (window.top !== window) return;
    try {
      const id = "job-filler-toast";
      document.getElementById(id)?.remove();
      const t = document.createElement("div");
      t.id = id; t.textContent = text;
      Object.assign(t.style, {
        position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
        background: ok ? "#111827" : "#b91c1c", color: "#fff",
        padding: "8px 12px", borderRadius: "8px",
        font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
      });
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1600);
    } catch {}
  }

  // ================== TEXT INPUTS ==================
  // (labels / placeholder / name / aria-label, deep-search, exclude non-text)
  function labelTextFor(el) {
    if (!el) return "";
    const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (byFor) return (byFor.textContent || "").trim();
    let p = el.parentElement;
    while (p && p !== document.body) {
      if (p.tagName === "LABEL") return (p.textContent || "").trim();
      p = p.parentElement;
    }
    return "";
  }
  const textInputs = queryAllDeep('input, textarea')
    .filter(el => {
      const t = (el.type || "").toLowerCase();
      return !["button","submit","checkbox","radio","file","hidden"].includes(t);
    });

  const textBag = (el) => {
    const join = (...xs) => xs.filter(Boolean).join(" ").toLowerCase();
    return join(el.placeholder, el.name, el.id, el.getAttribute?.("aria-label"), labelTextFor(el));
  };
  const findText = (keys) => textInputs.find(el => {
    const bag = textBag(el);
    return keys.some(k => bag.includes(k.toLowerCase()));
  });

  // Name split or single
  const full = (data.name || "").trim();
  const [first, ...rest] = full.split(/\s+/);
  const last = rest.join(" ");

  const firstEl = findText(["first name","given name","fname"]);
  const lastEl  = findText(["last name","surname","family name","lname"]);
  if (firstEl) setReactSafe(firstEl, first);
  if (lastEl)  setReactSafe(lastEl,  last);
  if (!firstEl && !lastEl) {
    const nameEl = findText(["name","full name","applicant name"]);
    if (nameEl) setReactSafe(nameEl, full);
  }

  if (data.email)    { const el = findText(["email","e-mail"]); if (el) setReactSafe(el, data.email); }
  if (data.phone)    { const el = findText(["phone","mobile","tel","telephone"]); if (el) setReactSafe(el, data.phone); }
  if (data.address)  { const el = findText(["address","street","location"]); if (el) setReactSafe(el, data.address); }
  if (data.linkedin) { const el = findText(["linkedin","linkedin url","social"]); if (el) setReactSafe(el, data.linkedin); }
  if (data.github)   { const el = findText(["github","portfolio","website","personal site"]); if (el) setReactSafe(el, data.github); }
  if (data.summary)  { const el = findText(["summary","cover letter","description","bio","about"]); if (el) setReactSafe(el, data.summary); }

  // ================== CHOICE CONTROLS ==================
  // Find likely "question containers" by keywords, then choose value inside.
  function findGroupsByKeys(keys) {
    const nodes = queryAllDeep('fieldset, section, div, li, [role="group"], [role="radiogroup"], [data-automation-id]');
    const out = [];
    for (const el of nodes) {
      if (inNav(el)) continue;
      const txt = toL(el.textContent || "");
      if (!txt) continue;
      if (keys.some(k => txt.includes(toL(k)))) out.push(el);
    }
    // prefer smaller, more focused containers with actual controls inside
    return out
      .map(el => {
        const hasControl = !!el.querySelector(
          'select, input[type="radio"], input[type="checkbox"], [role="combobox"], [aria-haspopup="listbox"], [data-automation-id="selectBox"], [data-automation-id="select-selectedOption"]'
        );
        const r = el.getBoundingClientRect();
        const areaScore = r ? Math.max(0, 200000 - (r.width * r.height)) / 50000 : 0;
        const tagScore  = el.tagName === "FIELDSET" ? 3 : /SECTION|DIV|LI/.test(el.tagName) ? 2 : 1;
        const score = (hasControl ? 10 : 0) + tagScore + areaScore;
        return { el, score };
      })
      .sort((a,b)=>b.score-a.score)
      .map(x=>x.el);
  }

  function readSelectedText(container) {
    const a = queryAllDeep('[data-automation-id="select-selectedOption"]', container)[0];
    if (a?.textContent) return a.textContent.trim();

    const b = queryAllDeep('[data-automation-id="select-selectedOptionLabel"]', container)[0];
    if (b?.textContent) return b.textContent.trim();

    const sel = queryAllDeep('select', container)[0];
    if (sel && sel.selectedIndex >= 0) {
      const opt = sel.options[sel.selectedIndex];
      if (opt) return (opt.text || opt.value || "").trim();
    }

    const checked = queryAllDeep('input[type="radio"]:checked, input[type="checkbox"]:checked', container)[0];
    if (checked) {
      let labelText = "";
      if (checked.id) {
        const lab = container.querySelector(`label[for="${CSS.escape(checked.id)}"]`);
        if (lab?.textContent) labelText = lab.textContent.trim();
      }
      if (!labelText) {
        const lab = checked.closest('label');
        if (lab?.textContent) labelText = lab.textContent.trim();
      }
      return labelText || "checked";
    }
    return "";
  }

  function setNativeSelect(container, targetText) {
    const sel = queryAllDeep('select', container)[0];
    if (!sel) return false;
    let idx = -1;
    for (let i = 0; i < sel.options.length; i++) {
      const t = (sel.options[i].text || sel.options[i].value || "").trim();
      if (matchesAnswer(t, targetText)) { idx = i; break; }
    }
    if (idx === -1) return false;
    sel.selectedIndex = idx;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function setRadioOrCheckbox(container, targetText) {
    const radios = queryAllDeep('input[type="radio"]', container);
    if (radios.length) {
      for (const r of radios) {
        let txt = "";
        if (r.id) {
          const lab = container.querySelector(`label[for="${CSS.escape(r.id)}"]`);
          if (lab?.textContent) txt = lab.textContent.trim();
        }
        if (!txt) {
          const lab = r.closest('label');
          if (lab?.textContent) txt = lab.textContent.trim();
        }
        if (matchesAnswer(txt, targetText) || matchesAnswer(r.value || "", targetText)) {
          if (!r.checked) { r.scrollIntoView({ block: "center" }); realClick(r); r.dispatchEvent(new Event("change", { bubbles: true })); }
          return true;
        }
      }
    }
    const checks = queryAllDeep('input[type="checkbox"]', container);
    for (const c of checks) {
      let txt = "";
      if (c.id) {
        const lab = container.querySelector(`label[for="${CSS.escape(c.id)}"]`);
        if (lab?.textContent) txt = lab.textContent.trim();
      }
      if (!txt) {
        const lab = c.closest('label');
        if (lab?.textContent) txt = lab.textContent.trim();
      }
      if (matchesAnswer(txt, targetText) || matchesAnswer(c.value || "", targetText)) {
        if (!c.checked) { c.scrollIntoView({ block: "center" }); realClick(c); c.dispatchEvent(new Event("change", { bubbles: true })); }
        return true;
      }
    }
    return false;
  }

  function openDropdown(container) {
    const triggers = [
      ...queryAllDeep('[data-automation-id="selectBox"]', container),
      ...queryAllDeep('[data-automation-id="select-selectedOption"]', container),
      ...queryAllDeep('button[aria-haspopup="listbox"]', container),
      ...queryAllDeep('[aria-haspopup="listbox"]', container),
      ...queryAllDeep('[role="combobox"]', container),
      ...queryAllDeep('select', container),
    ].filter(t => !inNav(t));
    const trigger = triggers[0] || null;
    if (!trigger || !visible(trigger)) return null;
    trigger.scrollIntoView({ block: "center" });
    trigger.focus?.();
    realClick(trigger);
    return trigger;
  }

  function clickTargetFromOpenList(trigger, targetText) {
    const tRect = trigger.getBoundingClientRect();
    const tCx = tRect.left + tRect.width / 2;
    const tCy = tRect.top + tRect.height / 2;

    const options = queryAllDeep('[data-automation-id="select-option"], [role="option"]', document);
    const candidates = options
      .map(o => {
        const r = o.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(cx - tCx, cy - tCy);
        return { o, dist, text: (o.textContent || "").trim() };
      })
      .filter(x => matchesAnswer(x.text, targetText))
      .sort((a, b) => a.dist - b.dist);

    if (!candidates.length) return false;
    const optEl = candidates[0].o.closest('[role="option"], [data-automation-id="select-option"]') || candidates[0].o;
    optEl.scrollIntoView({ block: "center" });
    realClick(optEl);
    return true;
  }

  async function typeThenEnter(targetText) {
    const el = document.activeElement;
    if (!el) return false;
    const role = el.getAttribute?.("role");
    const isEditable = role === "combobox" || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
    if (!isEditable) return false;

    el.focus();
    if ("value" in el) {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.value = targetText;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 80));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    await new Promise(r => setTimeout(r, 140));
    return true;
  }

  async function chooseValue(container, targetText) {
    try {
      if (setNativeSelect(container, targetText)) { await new Promise(r=>setTimeout(r,100)); return matchesAnswer(readSelectedText(container), targetText); }
      if (setRadioOrCheckbox(container, targetText)) { await new Promise(r=>setTimeout(r,100)); return matchesAnswer(readSelectedText(container), targetText); }

      const trigger = openDropdown(container);
      if (!trigger) return false;
      await new Promise(r=>setTimeout(r,160));

      let acted = clickTargetFromOpenList(trigger, targetText);
      if (!acted) { await new Promise(r=>setTimeout(r,180)); acted = clickTargetFromOpenList(trigger, targetText); }
      if (!acted) { acted = await typeThenEnter(targetText); }

      if (acted) {
        await new Promise(r=>setTimeout(r,160));
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        trigger.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      }

      await new Promise(r=>setTimeout(r,220));
      let v = readSelectedText(container);
      if (matchesAnswer(v, targetText)) return true;

      // one retry
      realClick(trigger);
      await new Promise(r=>setTimeout(r,160));
      clickTargetFromOpenList(trigger, targetText);
      await new Promise(r=>setTimeout(r,200));
      v = readSelectedText(container);
      return matchesAnswer(v, targetText);
    } catch (e) {
      console.warn("chooseValue error:", e);
      return false;
    }
  }

  // High-level: given keywords and a value, try to set it
  async function setChoice(keys, value) {
    if (!value) return false;
    const groups = findGroupsByKeys(keys);
    let ok = false;
    for (const g of groups) {
      g.scrollIntoView({ block: "center" });
      if (await chooseValue(g, value)) { ok = true; break; }
    }

    // Fallback: try page-level (no group hit)
    if (!ok) ok = await chooseValue(document.body, value);
    return ok;
  }

  // ================== apply user data to questions ==================
  const tasks = [];

  tasks.push(setChoice(
    ["authorized to work in the united states","work authorization","work authorized","us work authorization","us work eligible"],
    data.workAuthUS
  ));

  tasks.push(setChoice(
    ["legally able to work","country where this job is located","work in the country"],
    data.legalWorkCountry
  ));

  tasks.push(setChoice(
    ["age","age category","years of age","18 years"],
    data.ageCategory
  ));

  tasks.push(setChoice(
    ["provide work authorization within 3 days","3 days of your hire","i-9 within 3 days"],
    data.provideAuth3Days
  ));

  tasks.push(setChoice(
    ["require sponsorship","future sponsorship","now or in the future","immigration-related employment benefit"],
    data.needSponsorship
  ));

  tasks.push(setChoice(
    ["meet all minimum qualifications","minimum qualifications","qualifications for this job"],
    data.meetsMinQuals
  ));

  Promise.allSettled(tasks).then(() => toast("✔ Form Filled"));
}

// ---- Hotkey: Alt+2 fills with saved data (now includes compliance/selects) ----
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-form") return;

  // clear any "SET" badge once user used the shortcut
  await chrome.action.setBadgeText({ text: "" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const data = await chrome.storage.local.get([
    "name","email","phone","address","linkedin","github","summary",
    "workAuthUS","legalWorkCountry","ageCategory",
    "provideAuth3Days","needSponsorship","meetsMinQuals"
  ]); // popup stores these keys
  // (Popup fields & storage keys come from your UI) — see popup.html/popup.js.

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: pageFillFn,
    args: [data]
  });
});

 * 
 * 
 * 
 * **/