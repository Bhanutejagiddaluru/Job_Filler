// ==============================
// Job Filler - background.js (superset / restored)
// - Keeps ALL prior helpers
// - Adds user Text Q&A AND robust Choice Q&A
// - Alt+2 runs: defaults -> Text Q&A -> Choice Q&A
// ==============================

// ---- Shortcut helper ----
async function needsShortcut() {
  const cmds = await chrome.commands.getAll();
  const cmd = cmds.find(c => c.name === "fill-form");
  return !cmd || !cmd.shortcut;
}
async function promptForShortcut() {
  await chrome.action.setBadgeText({ text: "SET" });
  await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); } catch {}
}
async function clearBadgeIfReady() {
  if (!(await needsShortcut())) await chrome.action.setBadgeText({ text: "" });
}
chrome.runtime.onInstalled.addListener(async () => {
  if (await needsShortcut()) await promptForShortcut(); else await clearBadgeIfReady();
});
chrome.runtime.onStartup.addListener(async () => {
  if (await needsShortcut()) await promptForShortcut(); else await clearBadgeIfReady();
});

// ================== TEXT DEFAULTS ==================
function pageFillFn_TEXT_ONLY_DEFAULTS(data) {
  const setReactSafe = (el, value) => {
    if (!el) return;
    const proto = el.__proto__ || Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = desc && desc.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const visible = (el) => {
    const t = (el.type || "").toLowerCase();
    if (["button","submit","checkbox","radio","file","hidden"].includes(t)) return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };

  const inputs = Array.from(document.querySelectorAll("input, textarea")).filter(visible);

  const find = (keys) =>
    inputs.find((el) => {
      const combined = [
        el.placeholder, el.name, el.id, el.getAttribute("aria-label"),
        (document.querySelector(`label[for="${el.id}"]`) || {})?.textContent
      ].join(" ").toLowerCase();
      return keys.some((k) => combined.includes(k.toLowerCase()));
    });

  const full = (data.name || "").trim();
  const [first, ...rest] = full.split(/\s+/);
  const last = rest.join(" ");

  const firstEl = find(["first name","given name","fname"]);
  const lastEl  = find(["last name","surname","family name","lname"]);
  if (firstEl) setReactSafe(firstEl, first);
  if (lastEl)  setReactSafe(lastEl,  last);
  if (!firstEl && !lastEl) {
    const nameEl = find(["name","full name","applicant name"]);
    if (nameEl) setReactSafe(nameEl, full);
  }

  if (data.email)    setReactSafe(find(["email","e-mail"]), data.email);
  if (data.phone)    setReactSafe(find(["phone","mobile","tel","telephone"]), data.phone);
  if (data.address)  setReactSafe(find(["address","street","location"]), data.address);
  if (data.linkedin) setReactSafe(find(["linkedin","linkedin url","social"]), data.linkedin);
  if (data.github)   setReactSafe(find(["github","portfolio","website","personal site"]), data.github);
  if (data.summary)  setReactSafe(find(["summary","cover letter","description","bio","about"]), data.summary);
}

// ================== USER TEXT Q&A ==================
function pageFillFn_TEXT_QA_ONLY(textQaPairs) {
  (async function () {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const toL = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

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

    function setReactSafe(el, value) {
      const proto = el.__proto__ || Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      const setter = desc && desc.set;
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function findContainerStrict(question) {
      const needle = toL(question);
      if (!needle) return null;
      const candidates = queryAllDeep('fieldset, section, div, li, [role="group"], article, form, tr');
      let best = null, bestScore = -1;

      for (const el of candidates) {
        const text = toL(el.textContent || "");
        if (!text.includes(needle)) continue;

        const hasTextControl = !!el.querySelector('input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="search"], input[type="number"], textarea, [contenteditable=""], [contenteditable="true"]');
        if (!hasTextControl) continue;

        const rect = el.getBoundingClientRect();
        const areaScore = rect ? Math.max(0, 200000 - (rect.width * rect.height)) / 50000 : 0;

        const score =
          (hasTextControl ? 10 : 0) +
          (el.tagName === "FIELDSET" ? 3 : /SECTION|DIV|LI|FORM|ARTICLE/.test(el.tagName) ? 2 : 1) +
          areaScore;

        if (score > bestScore) { best = el; bestScore = score; }
      }
      return best;
    }

    function getPriorityTextInput(container) {
      const candidates = queryAllDeep(
        'textarea, input[type="text"], input:not([type]), input[type="email"], input[type="tel"], input[type="url"], input[type="search"], input[type="number"], [contenteditable=""], [contenteditable="true"]',
        container
      );

      const scored = candidates.map(el => {
        const r = el.getBoundingClientRect();
        const area = (r?.width || 0) * (r?.height || 0);
        const isTextarea = el.tagName === "TEXTAREA" || el.isContentEditable;
        return { el, score: (isTextarea ? 2 : 0) + Math.min(area / 2000, 3) };
      }).sort((a, b) => b.score - a.score);

      return scored[0]?.el || null;
    }

    function typeInto(el, value) {
      if (!el) return false;
      if (el.isContentEditable) {
        el.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, value);
        return true;
      }
      setReactSafe(el, value);
      return true;
    }

    if (!Array.isArray(textQaPairs) || !textQaPairs.length) return;

    for (const pair of textQaPairs) {
      const q = pair?.q || pair?.[0];
      const a = pair?.a || pair?.[1];
      if (!q || !a) continue;

      const container = findContainerStrict(q);
      if (!container) continue;

      const target = getPriorityTextInput(container);
      if (!target) continue;

      target.scrollIntoView({ block: "center" });
      typeInto(target, a);
      await sleep(80);
    }
  })();
}

// ================== USER CHOICE Q&A (robust; restored helpers) ==================
function pageFillFn_CHOICES_ONLY(QA) {
  (async function () {
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

    function escapeRe(s){ return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"); }
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

    function isYesText(s) { const t = toL(s); return t === "yes" || t === "y" || t.startsWith("yes"); }
    function isNoText(s)  { const t = toL(s); return t === "no"  || t === "n" || t.startsWith("no"); }
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
    function pageHasQuestionText(q) {
      const needle = toL(q);
      return !!needle && PAGE_TXT.includes(needle);
    }

    async function waitForContainer(question, timeoutMs = 5000) {
      const start = performance.now();
      let container = null;
      while (performance.now() - start < timeoutMs) {
        container = findContainerStrict(question);
        if (container) return container;
        await sleep(150);
      }
      return null;
    }

    function findContainerStrict(question) {
      const needle = toL(question);
      if (!needle) return null;
      const candidates = queryAllDeep('fieldset, section, div, li, [role="group"], [role="radiogroup"], [data-automation-id]');
      let best = null, bestScore = -1;

      for (const el of candidates) {
        const text = toL(el.textContent || "");
        if (!text.includes(needle)) continue;
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
        setTimeout(() => t.remove(), 2200);
      } catch {}
    }

    if (!Array.isArray(QA) || QA.length === 0) return;

    if (countCandidateControls() === 0) {
      const anyQuestionOnPage = QA.some(pair => {
        const q = pair?.q || pair?.[0];
        return q && pageHasQuestionText(q);
      });
      if (!anyQuestionOnPage) return;
    }

    const results = [];
    for (const pair of QA) {
      const q = pair?.q || pair?.[0];
      const ans = pair?.a || pair?.[1];
      if (!q || !ans) { results.push("—"); continue; }

      if (!pageHasQuestionText(q)) { results.push(`${q.slice(0, 22)}… —`); continue; }

      const c = await waitForContainer(q, 5000);
      if (!c) { results.push(`${q.slice(0, 22)}… ✗`); continue; }

      c.scrollIntoView({ block: "center" });
      await sleep(80);

      const ok = await chooseValue(c, ans);
      results.push(`${q.slice(0, 22)}… ${ok ? "✓" : "✗"}`);
      await sleep(140);
    }

    if (window.top === window) toast(results.join("  "));
  })();
}

// ---- Hotkey: Alt+2 -> defaults, then text-QA, then choice-QA
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-form") return;

  await chrome.action.setBadgeText({ text: "" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const data = await chrome.storage.local.get([
    "name","email","phone","address","linkedin","github","summary",
    "textQaPairs","qaPairs"
  ]);

  // 1) fill standard text fields
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: pageFillFn_TEXT_ONLY_DEFAULTS,
    args: [data]
  });

  // 2) user-defined text Q/A
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: pageFillFn_TEXT_QA_ONLY,
    args: [Array.isArray(data.textQaPairs) ? data.textQaPairs : []]
  });

  // 3) user-defined choice Q/A
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: pageFillFn_CHOICES_ONLY,
    args: [Array.isArray(data.qaPairs) ? data.qaPairs : []]
  });
});
