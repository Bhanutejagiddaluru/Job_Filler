// background.js
// Hotkey: define "fill-fixed" = Alt+2 in manifest.json "commands"

const Q1 = "Do you certify you meet all minimum qualifications for this job as outlined in the job posting?";
const Q2 = "Are you legally able to work in the country where this job is located?";

async function fillTwoFixedYes(targets) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const toL = (s) => (s || "").toLowerCase().trim();
  const isYesText = (s) => {
    const t = toL(s);
    return t === "yes" || t.startsWith("yes") || t === "y";
  };

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };

  // Deep DOM (incl. shadow roots)
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

  // --- Find the question container (and prefer ones that also contain a control) ---
  function findContainerStrict(question) {
    const needle = toL(question);
    if (!needle) return null;
    const candidates = queryAllDeep('fieldset, section, div, li, [role="group"], [role="radiogroup"], [data-automation-id]');
    let best = null, bestScore = -1;

    for (const el of candidates) {
      const text = toL(el.textContent || "");
      if (!text.includes(needle)) continue;

      const hasControl = !!(
        el.querySelector('select, input[type="radio"], input[type="checkbox"], [role="combobox"], [aria-haspopup="listbox"], [data-automation-id="selectBox"], [data-automation-id="select-selectedOption"]')
      );

      // deprioritize obvious nav/header areas
      const inNav = !!el.closest('header, nav, [role="navigation"], .nav, .navbar');

      const score =
        (hasControl ? 10 : 0) +
        (el.tagName === "FIELDSET" ? 3 : /SECTION|DIV|LI/.test(el.tagName) ? 2 : 1) +
        (inNav ? -10 : 0);

      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }

  function realClick(el) {
    if (!el) return;
    ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    );
  }

  // --- STRICT readback confined to the container ---
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

  // --- Writers (ALL scoped to container) ---
  function setNativeSelectYes(container) {
    const sel = queryAllDeep('select', container)[0];
    if (!sel) return false;
    let idx = -1;
    for (let i = 0; i < sel.options.length; i++) {
      const t = (sel.options[i].text || sel.options[i].value || "").trim();
      if (isYesText(t)) { idx = i; break; }
    }
    if (idx === -1) return false;
    sel.selectedIndex = idx;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function setRadioOrCheckboxYes(container) {
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
        if (isYesText(txt)) {
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
      if (isYesText(txt)) {
        if (!c.checked) { c.scrollIntoView({ block: "center" }); realClick(c); c.dispatchEvent(new Event("change", { bubbles: true })); }
        return true;
      }
    }
    return false;
  }

  function openDropdown(container) {
    // CRUCIAL: only look INSIDE the container (not the whole page)
    const trigger =
      queryAllDeep('[data-automation-id="selectBox"]', container)[0] ||
      queryAllDeep('[data-automation-id="select-selectedOption"]', container)[0] ||
      queryAllDeep('button[aria-haspopup="listbox"]', container)[0] ||
      queryAllDeep('[aria-haspopup="listbox"]', container)[0] ||
      queryAllDeep('[role="combobox"]', container)[0] ||
      queryAllDeep('select', container)[0];

    if (!trigger || !visible(trigger)) return null;
    trigger.scrollIntoView({ block: "center" });
    trigger.focus?.();
    realClick(trigger);
    return trigger;
  }

  function clickYesFromOpenList() {
    // Options may render in a body-level portal
    const options = queryAllDeep('[data-automation-id="select-option"], [role="option"]', document);
    const yesNode = options.find(o => visible(o) && isYesText((o.textContent || "").trim()));
    if (!yesNode) return false;
    const opt = yesNode.closest('[role="option"], [data-automation-id="select-option"]') || yesNode;
    opt.scrollIntoView({ block: "center" });
    realClick(opt);
    return true;
  }

  async function typeYesThenEnter() {
    const el = document.activeElement;
    if (!el) return false;
    const role = el.getAttribute("role");
    const isEditable = role === "combobox" || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
    if (!isEditable) return false;

    el.focus();
    if ("value" in el) {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.value = "Yes";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await sleep(80);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    await sleep(140);
    return true;
  }

  async function chooseYes(container) {
    // Fast paths
    if (setNativeSelectYes(container)) { await sleep(100); return isYesText(readSelectedText(container)); }
    if (setRadioOrCheckboxYes(container)) { await sleep(100); return isYesText(readSelectedText(container)); }

    // Custom dropdowns
    const trigger = openDropdown(container);
    if (!trigger) return false;
    await sleep(160);

    let acted = clickYesFromOpenList();
    if (!acted) { await sleep(180); acted = clickYesFromOpenList(); }
    if (!acted) { acted = await typeYesThenEnter(); }

    if (acted) {
      await sleep(160);
      // Some UIs require an extra Enter to commit
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      trigger.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    }

    await sleep(220);
    let v = readSelectedText(container);
    if (isYesText(v)) return true;

    // one retry
    realClick(trigger);
    await sleep(160);
    clickYesFromOpenList();
    await sleep(200);
    v = readSelectedText(container);
    return isYesText(v);
  }

  function toast(text) {
    if (window.top !== window) return;
    try {
      const id = "autofill_toast";
      document.getElementById(id)?.remove();
      const t = document.createElement("div");
      t.id = id; t.textContent = text;
      Object.assign(t.style, {
        position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
        background: "#0f766e", color: "#fff", padding: "8px 12px",
        borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
      });
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1800);
    } catch {}
  }

  // --- Execute per frame, but verify strictly in each container ---
  const c1 = findContainerStrict(targets.q1);
  const ok1 = c1 ? await chooseYes(c1) : null;

  const c2 = findContainerStrict(targets.q2);
  const ok2 = c2 ? await chooseYes(c2) : null;

  if (window.top === window) {
    const parts = [];
    if (ok1 !== null) parts.push(`Q1 ${ok1 ? "✓" : "✗"}`);
    if (ok2 !== null) parts.push(`Q2 ${ok2 ? "✓" : "✗"}`);
    if (parts.length) toast(`Fixed fill verified: ${parts.join("  ")}`);
  }
}

// Hotkey handler (ensure manifest has a matching "commands" entry for Alt+2)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-fixed") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: fillTwoFixedYes,
    args: [{ q1: Q1, q2: Q2 }]
  });
});
