const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),
  qaList: document.getElementById("qaList"),
  qa_new_q: document.getElementById("qa_new_q"),
  qa_new_a: document.getElementById("qa_new_a"),
  qa_add: document.getElementById("qa_add"),
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
};

let state = {
  qaPairs: []
};

function renderQA() {
  els.qaList.innerHTML = "";
  state.qaPairs.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "qa-row";
    row.innerHTML = `
      <div>
        <label>Question</label>
        <input value="${item.q || ""}" data-idx="${idx}" data-k="q" />
      </div>
      <div>
        <label>Answer</label>
        <input value="${item.a || ""}" data-idx="${idx}" data-k="a" />
      </div>
      <button class="remove" data-idx="${idx}">Remove</button>
    `;
    els.qaList.appendChild(row);
  });

  els.qaList.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.idx);
      const k = e.target.dataset.k;
      state.qaPairs[i][k] = e.target.value;
    });
  });
  els.qaList.querySelectorAll(".remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.idx);
      state.qaPairs.splice(i, 1);
      renderQA();
    });
  });
}

function addQA() {
  const q = els.qa_new_q.value.trim();
  const a = els.qa_new_a.value.trim();
  if (!q || !a) return;
  state.qaPairs.push({ q, a });
  els.qa_new_q.value = "";
  els.qa_new_a.value = "";
  renderQA();
}

// ---- storage ----
function load() {
  chrome.storage.local.get(
    {
      name: "", email: "", phone: "", address: "",
      linkedin: "", github: "", summary: "",
      qaPairs: []
    },
    (res) => {
      els.name.value = res.name;
      els.email.value = res.email;
      els.phone.value = res.phone;
      els.address.value = res.address;
      els.linkedin.value = res.linkedin;
      els.github.value = res.github;
      els.summary.value = res.summary;
      state.qaPairs = Array.isArray(res.qaPairs) ? res.qaPairs : [];
      renderQA();
    }
  );
}

function save() {
  chrome.storage.local.set(
    {
      name: els.name.value.trim(),
      email: els.email.value.trim(),
      phone: els.phone.value.trim(),
      address: els.address.value.trim(),
      linkedin: els.linkedin.value.trim(),
      github: els.github.value.trim(),
      summary: els.summary.value,
      qaPairs: state.qaPairs.filter(x => x.q?.trim() && x.a?.trim())
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

// ---- lightweight text-field filler (unchanged) + choice filler trigger ----
function pageFillFn_TEXT_ONLY(data) {
  const setReactSafe = (el, value) => {
    if (!el) return;
    const proto = el.__proto__ || Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = desc && desc.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const inputs = Array.from(document.querySelectorAll("input, textarea")).filter((el) => {
    const t = (el.type || "").toLowerCase();
    if (["button","submit","checkbox","radio","file","hidden"].includes(t)) return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
  });

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

async function fillOnPage() {
  chrome.storage.local.get(
    ["name","email","phone","address","linkedin","github","summary","qaPairs"],
    async (data) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // 1) fill text fields
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_TEXT_ONLY,
        args: [data]
      });

      // 2) fill ONLY checkbox/radio/select using robust logic (QA from user)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_CHOICES_ONLY,
        args: [data.qaPairs || []]
      });

      els.fillBtn.textContent = "Filled ✓";
      setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
    }
  );
}

els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
els.qa_add.addEventListener("click", addQA);
document.addEventListener("DOMContentLoaded", load);

// ====================== THE SAME CHOICE LOGIC (imported) =====================
// exactly the robust selection logic, but fed by user QA pairs
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

    // ===== MAIN =====
    if (!Array.isArray(QA) || QA.length === 0) return;

    if (countCandidateControls() === 0) {
      const anyQuestionOnPage = QA.some(([q]) => pageHasQuestionText(q));
      if (!anyQuestionOnPage) return; // exit silently
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
