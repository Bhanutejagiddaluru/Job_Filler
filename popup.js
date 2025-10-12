const els = {
  // basics
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),

  // text Q/A
  textQaList: document.getElementById("textQaList"),
  tqa_new_q: document.getElementById("tqa_new_q"),
  tqa_new_a: document.getElementById("tqa_new_a"),
  tqa_add: document.getElementById("tqa_add"),

  // choice Q/A
  qaList: document.getElementById("qaList"),
  qa_new_q: document.getElementById("qa_new_q"),
  qa_new_a: document.getElementById("qa_new_a"),
  qa_add: document.getElementById("qa_add"),

  // actions
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
};

let state = {
  qaPairs: [],
  textQaPairs: []
};

// ---------- renderers ----------
function renderChoiceQA() {
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
      <button class="danger" data-idx="${idx}">Remove</button>
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
  els.qaList.querySelectorAll(".danger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.idx);
      state.qaPairs.splice(i, 1);
      renderChoiceQA();
    });
  });
}

function renderTextQA() {
  els.textQaList.innerHTML = "";
  state.textQaPairs.forEach((item, idx) => {
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
      <button class="danger" data-idx="${idx}">Remove</button>
    `;
    els.textQaList.appendChild(row);
  });

  els.textQaList.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.idx);
      const k = e.target.dataset.k;
      state.textQaPairs[i][k] = e.target.value;
    });
  });
  els.textQaList.querySelectorAll(".danger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.idx);
      state.textQaPairs.splice(i, 1);
      renderTextQA();
    });
  });
}

// ---------- add handlers ----------
function addChoiceQA() {
  const q = els.qa_new_q.value.trim();
  const a = els.qa_new_a.value.trim();
  if (!q || !a) return;
  state.qaPairs.push({ q, a });
  els.qa_new_q.value = "";
  els.qa_new_a.value = "";
  renderChoiceQA();
}

function addTextQA() {
  const q = els.tqa_new_q.value.trim();
  const a = els.tqa_new_a.value.trim();
  if (!q || !a) return;
  state.textQaPairs.push({ q, a });
  els.tqa_new_q.value = "";
  els.tqa_new_a.value = "";
  renderTextQA();
}

// ---------- storage ----------
function load() {
  chrome.storage.local.get(
    {
      name: "", email: "", phone: "", address: "",
      linkedin: "", github: "", summary: "",
      qaPairs: [],
      textQaPairs: []
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
      renderChoiceQA();

      state.textQaPairs = Array.isArray(res.textQaPairs) ? res.textQaPairs : [];
      renderTextQA();
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
      qaPairs: state.qaPairs.filter(x => x.q?.trim() && x.a?.trim()),
      textQaPairs: state.textQaPairs.filter(x => x.q?.trim() && x.a?.trim())
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

// ---------- fill trigger ----------
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

// user-defined text Q & A
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

        const hasTextControl = !!el.querySelector('input[type="text"], input:not([type]), input[type="email"], input[type="tel"], input[type="url"], input[type="search"], input[type="number"], textarea, [contenteditable=""], [contenteditable="true"]');
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

      // prefer larger visible inputs and textareas
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

async function fillOnPage() {
  chrome.storage.local.get(
    ["name","email","phone","address","linkedin","github","summary","qaPairs","textQaPairs"],
    async (data) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // 1) default text fields (name/email/...)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_TEXT_ONLY_DEFAULTS,
        args: [data]
      });

      // 2) user-defined TEXT Q&A
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_TEXT_QA_ONLY,
        args: [Array.isArray(data.textQaPairs) ? data.textQaPairs : []]
      });

      // 3) user-defined CHOICE Q&A (checkbox/radio/select)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_CHOICES_ONLY,
        args: [Array.isArray(data.qaPairs) ? data.qaPairs : []]
      });

      els.fillBtn.textContent = "Filled ✓";
      setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
    }
  );
}

// events
els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
els.qa_add.addEventListener("click", addChoiceQA);
els.tqa_add.addEventListener("click", addTextQA);
document.addEventListener("DOMContentLoaded", load);

// ============ import the CHOICE logic so popup-only fill also works ============
function pageFillFn_CHOICES_ONLY(QA) {
  // (identical to background.js version; kept here so Fill button works without hotkey)
  // -- trimmed for brevity in popup; the background copy is authoritative --
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
    function realClick(el) {
      if (!el) return;
      ["pointerdown","mousedown","mouseup","click"].forEach(t =>
        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
      );
    }
    function matchesAnswer(text, target) {
      const a = toL(text), b = toL(target);
      if (b === "yes" || b.startsWith("yes")) return a === "yes" || a.startsWith("yes");
      if (b === "no" || b.startsWith("no"))  return a === "no"  || a.startsWith("no");
      return a === b || a.includes(b) || b.includes(a);
    }
    function findContainerStrict(question) {
      const needle = toL(question);
      if (!needle) return null;
      const candidates = queryAllDeep('fieldset, section, div, li, [role="group"], [role="radiogroup"], [data-automation-id]');
      let best = null, bestScore = -1;
      for (const el of candidates) {
        const text = toL(el.textContent || "");
        if (!text.includes(needle)) continue;
        const hasControl = !!el.querySelector(
          'select, input[type="radio"], input[type="checkbox"], [role="combobox"], [aria-haspopup="listbox"], [data-automation-id="selectBox"], [data-automation-id="select-selectedOption"]'
        );
        if (!hasControl) continue;
        const rect = el.getBoundingClientRect();
        const areaScore = rect ? Math.max(0, 200000 - (rect.width * rect.height)) / 50000 : 0;
        const score = 10 + areaScore;
        if (score > bestScore) { best = el; bestScore = score; }
      }
      return best;
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
    async function chooseValue(container, targetText) {
      if (setNativeSelect(container, targetText)) return true;
      if (setRadioOrCheckbox(container, targetText)) return true;
      return false;
    }

    if (!Array.isArray(QA) || QA.length === 0) return;

    for (const pair of QA) {
      const q = pair?.q || pair?.[0];
      const ans = pair?.a || pair?.[1];
      if (!q || !ans) continue;

      const c = findContainerStrict(q);
      if (!c) continue;

      c.scrollIntoView({ block: "center" });
      await sleep(60);
      await chooseValue(c, ans);
    }
  })();
}
