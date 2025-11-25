/* ===============================
   Job Filler - popup.js (enhanced)
   - Instant-save on Add/Remove
   - Drag-and-drop reordering with autosave
   - Visual handle in each row
   - Same fill orchestration as before
================================= */

// ---------- Element refs ----------
const els = {
  // basics
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),

  // Additional information (TEXT Q&A)
  textQaList: document.getElementById("textQaList"),
  tqa_new_q: document.getElementById("tqa_new_q"),
  tqa_new_a: document.getElementById("tqa_new_a"),
  tqa_add: document.getElementById("tqa_add"),

  // Choice Q&A (checkbox/radio/select)
  qaList: document.getElementById("qaList"),
  qa_new_q: document.getElementById("qa_new_q"),
  qa_new_a: document.getElementById("qa_new_a"),
  qa_add: document.getElementById("qa_add"),

  // actions
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),

  // ⭐ NEW BUTTON
  saveChoiceBtn: document.getElementById("saveChoiceBtn"),


  // SQDA
  sqda_new_question: document.getElementById("sqda_new_question"),
  sqda_add_question: document.getElementById("sqda_add_question"),

  sqdaAnswerArea: document.getElementById("sqdaAnswerArea"),
  sqdaActiveQuestion: document.getElementById("sqdaActiveQuestion"),

  sqda_new_answer: document.getElementById("sqda_new_answer"),
  sqda_add_answer: document.getElementById("sqda_add_answer"),

  sqdaList: document.getElementById("sqdaList"),
  saveSqdaBtn: document.getElementById("saveSqdaBtn")

};

// ---------- State ----------
let state = {
  qaPairs: [],       // [{q,a}]
  textQaPairs: []    // [{q,a}]
};
state.sqda = [];  


// ---------- Storage (load/save) ----------
function load() {
  chrome.storage.local.get(
    {
      name: "", email: "", phone: "", address: "",
      linkedin: "", github: "", summary: "",
      qaPairs: [],
      textQaPairs: [],
      sqda: []   // ⭐ add this default
    },
    (res) => {
      els.name.value = res.name;
      els.email.value = res.email;
      els.phone.value = res.phone;
      els.address.value = res.address;
      els.linkedin.value = res.linkedin;
      els.github.value = res.github;
      els.summary.value = res.summary;

      state.qaPairs = Array.isArray(res.qaPairs) ? deepCopyPairs(res.qaPairs) : [];
      state.textQaPairs = Array.isArray(res.textQaPairs) ? deepCopyPairs(res.textQaPairs) : [];

      renderChoiceQA();
      renderTextQA();

      // load SQDA
      // ⭐ Correct: pass res (not data)
      loadSqdaInternal(res);
    }
  );
}

function save() {
  const sanitizedChoice = state.qaPairs.filter(x => x && x.q?.trim() && x.a?.trim());
  const sanitizedText = state.textQaPairs.filter(x => x && x.q?.trim() && x.a?.trim());

  chrome.storage.local.set(
    {
      name: els.name.value.trim(),
      email: els.email.value.trim(),
      phone: els.phone.value.trim(),
      address: els.address.value.trim(),
      linkedin: els.linkedin.value.trim(),
      github: els.github.value.trim(),
      summary: els.summary.value,
      qaPairs: sanitizedChoice,
      textQaPairs: sanitizedText
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";

      // ⭐ NEW — CHOICE Save button visual update
      if (els.saveChoiceBtn) {
        els.saveChoiceBtn.textContent = "Saved ✓";
      }

      // Reset both after delay
      setTimeout(() => {
        els.saveBtn.textContent = "Save";
        if (els.saveChoiceBtn) {
          els.saveChoiceBtn.textContent = "Save";
        }
      }, 900);
    }
  );
}

// ---------- Rendering (Q&A editors) ----------
function renderChoiceQA() {
  els.qaList.innerHTML = "";
  state.qaPairs.forEach((item, idx) => {
    els.qaList.appendChild(makeQaRow("choice", idx, item.q || "", item.a || ""));
  });
  wireRowHandlers("choice");
  wireDnD("choice"); // drag reorder
}

function renderTextQA() {
  els.textQaList.innerHTML = "";
  state.textQaPairs.forEach((item, idx) => {
    els.textQaList.appendChild(makeQaRow("text", idx, item.q || "", item.a || ""));
  });
  wireRowHandlers("text");
  wireDnD("text"); // drag reorder
}

// SQDA
// =============================
// SQDA LOGIC
// =============================

// Add new SQDA Question
function addSqdaQuestion() {
  const q = els.sqda_new_question.value.trim();
  if (!q) return;

  state.sqda.push({
    question: q,
    answers: []
  });

  els.sqda_new_question.value = "";

  // activate new question in the answer panel
  els.sqdaActiveQuestion.textContent = q;
  els.sqdaAnswerArea.style.display = "block";
  els.sqda_new_answer.focus();

  renderSqda();
  saveSqdaInternal();
}


// Add new Answer to the currently active SQDA Question
function addSqdaAnswer() {
  const ans = els.sqda_new_answer.value.trim();
  if (!ans) return;

  const activeQ = els.sqdaActiveQuestion.textContent.trim();
  if (!activeQ) return;

  const grp = state.sqda.find(x => x.question === activeQ);
  if (!grp) return;

  grp.answers.push(ans);
  els.sqda_new_answer.value = "";

  renderSqda();
  saveSqdaInternal();
}


// Delete a single SQDA Answer
function deleteSqdaAnswer(qIndex, aIndex) {
  state.sqda[qIndex].answers.splice(aIndex, 1);
  renderSqda();
  saveSqdaInternal();
}


// Delete entire SQDA Question group
function deleteSqdaGroup(qIndex) {
  state.sqda.splice(qIndex, 1);
  renderSqda();
  saveSqdaInternal();

  // Hide answer panel if deleted
  els.sqdaAnswerArea.style.display = "none";
  els.sqdaActiveQuestion.textContent = "";
}


// Render SQDA List in UI
function renderSqda() {
  els.sqdaList.innerHTML = "";

  state.sqda.forEach((group, qIndex) => {

    const box = document.createElement("div");
    box.className = "sqda-group-box";

    // Header row (Question + Delete Group)
    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.alignItems = "center";
    headerRow.style.justifyContent = "space-between";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = group.question;

    // Delete group button
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete Group";
    delBtn.style.background = "#b91c1c";
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.style.padding = "4px 8px";
    delBtn.style.borderRadius = "6px";
    delBtn.style.cursor = "pointer";
    delBtn.onclick = () => deleteSqdaGroup(qIndex);

    headerRow.appendChild(title);
    headerRow.appendChild(delBtn);
    box.appendChild(headerRow);

    // Answers
    group.answers.forEach((ans, aIndex) => {
      const item = document.createElement("div");
      item.className = "sqda-answer-item";
      item.textContent = ans;

      const x = document.createElement("span");
      x.textContent = "✕";
      x.style.float = "right";
      x.style.cursor = "pointer";
      x.style.color = "#b91c1c";
      x.onclick = () => deleteSqdaAnswer(qIndex, aIndex);

      item.appendChild(x);
      box.appendChild(item);
    });

    // ⭐ Add Answer Button (NEW)
    const addAnsBtn = document.createElement("button");
    addAnsBtn.textContent = "Add Answer";
    addAnsBtn.style.marginTop = "6px";
    addAnsBtn.style.background = "#0ea5e9";
    addAnsBtn.style.color = "white";
    addAnsBtn.style.border = "none";
    addAnsBtn.style.padding = "4px 10px";
    addAnsBtn.style.borderRadius = "6px";
    addAnsBtn.style.cursor = "pointer";

    addAnsBtn.onclick = () => {
      // activate this question
      els.sqdaActiveQuestion.textContent = group.question;
      els.sqdaAnswerArea.style.display = "block";
      els.sqda_new_answer.focus();
    };

    box.appendChild(addAnsBtn);
    els.sqdaList.appendChild(box);
  });
}



// Save SQDA to storage
function saveSqdaInternal() {
  chrome.storage.local.set({ sqda: state.sqda }, () => {

    // Visual confirmation like Save button
    if (els.saveSqdaBtn) {
      els.saveSqdaBtn.textContent = "Saved ✓";

      setTimeout(() => {
        els.saveSqdaBtn.textContent = "Save SQDA";
      }, 900);
    }
  });
}


// Load SQDA from storage
function loadSqdaInternal(data) {
  state.sqda = Array.isArray(data.sqda) ? data.sqda : [];
  renderSqda();
}


function makeQaRow(kind, idx, qVal, aVal) {
  const wrap = document.createElement("div");
  wrap.className = "qa-row";
  wrap.innerHTML = `
    <span class="handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
    <div>
      <label>Question</label>
      <input value="${escapeHtmlAttr(qVal)}" data-kind="${kind}" data-idx="${idx}" data-k="q" />
    </div>
    <div>
      <label>Answer</label>
      <input value="${escapeHtmlAttr(aVal)}" data-kind="${kind}" data-idx="${idx}" data-k="a" />
    </div>
    <button class="danger" data-kind="${kind}" data-idx="${idx}">Remove</button>
  `;
  return wrap;
}

function wireRowHandlers(kind) {
  const container = kind === "choice" ? els.qaList : els.textQaList;

  // live edit (doesn't autosave every keystroke by default; you can add save() here if desired)
  container.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.target.dataset.idx);
      const k = e.target.dataset.k;
      if (kind === "choice") {
        state.qaPairs[i][k] = e.target.value;
      } else {
        state.textQaPairs[i][k] = e.target.value;
      }
    });
  });

  // remove with autosave
  container.querySelectorAll(".danger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.idx);
      if (kind === "choice") {
        state.qaPairs.splice(i, 1);
        renderChoiceQA();
        save();               // autosave after remove
      } else {
        state.textQaPairs.splice(i, 1);
        renderTextQA();
        save();               // autosave after remove
      }
    });
  });
}

function addChoiceQA() {
  const q = els.qa_new_q.value.trim();
  const a = els.qa_new_a.value.trim();
  if (!q || !a) return;
  state.qaPairs.push({ q, a });
  els.qa_new_q.value = "";
  els.qa_new_a.value = "";
  renderChoiceQA();
  save(); // autosave after add
}

function addTextQA() {
  const q = els.tqa_new_q.value.trim();
  const a = els.tqa_new_a.value.trim();
  if (!q || !a) return;
  state.textQaPairs.push({ q, a });
  els.tqa_new_q.value = "";
  els.tqa_new_a.value = "";
  renderTextQA();
  save(); // autosave after add
}

// ---------- Small helpers ----------
function escapeHtmlAttr(s) {
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function deepCopyPairs(arr) {
  return arr.map(x => ({ q: x?.q || "", a: x?.a || "" }));
}

function insertReorderHint(kind) {
  const container = kind === "choice" ? els.qaList : els.textQaList;
  // clear old hints first
  container.querySelectorAll(".reorder-hint").forEach(h => h.remove());

  // All hint names in desired order
  const labels = [ "Eligibility", "Sponsorship", "Previous Work and Agreements", "Relatives", "Relocation", "Gender","Race Ethnicity", "Veteran Status", "Disability Status", "Age", "Qualifications", "Background", "Agree", "No", "Mobile SMS", "Others"];

  // Create and insert all hints first
  labels.forEach((label, i) => {
    const hint = document.createElement("div");
    hint.className = "reorder-hint";
    hint.textContent = label;
    hint.setAttribute("draggable", "true");
    hint.dataset.hint = `h${i + 1}`; // stable ID (h1, h2, h3...)
    container.appendChild(hint);
  });

  // Now load saved hint positions and reinsert them at stored indexes
  chrome.storage.local.get({ hintPos: {} }, ({ hintPos }) => {
  const hints = Array.from(container.querySelectorAll(".reorder-hint"));

  // Pair each hint with its desired index; unknown -> Infinity (leave at end)
  const pairs = hints.map(h => {
    const key = `${kind}_${h.dataset.hint}`;
    const idx = Number.isInteger(hintPos[key]) ? hintPos[key] : Number.POSITIVE_INFINITY;
    return { el: h, idx };
  });

  // Place in ascending order of desired index
  pairs.sort((a, b) => a.idx - b.idx);

  for (const { el, idx } of pairs) {
    if (!Number.isInteger(idx)) continue; // leave unknowns where they are (just appended)
    // Recompute list each time to account for previous insertions
    const list = [...container.querySelectorAll(".qa-row, .reorder-hint")];
    const safeIdx = Math.max(0, Math.min(idx, list.length - 1));
    const target = list[safeIdx];
    if (target && target !== el) container.insertBefore(el, target);
  }
});

}


// helper: place a hint element at its saved index among (rows + hints)
function placeHintAtSavedIndex(container, kind, hintEl, hintPosObj) {
  const key = `${kind}_${hintEl.dataset.hint}`;  // e.g., "choice_h1" / "text_h2"
  const idxRaw = hintPosObj[key];
  if (!Number.isInteger(idxRaw)) return;

  // Build full, current list including this hint
  const list = [...container.querySelectorAll(".qa-row, .reorder-hint")];

  // Clamp target index
  const safeIdx = Math.max(0, Math.min(idxRaw, list.length - 1));

  // If target is the same element, nothing to do
  const target = list[safeIdx];
  if (!target || target === hintEl) return;

  container.insertBefore(hintEl, target);
}


function renderChoiceQA() {
  els.qaList.innerHTML = "";
  state.qaPairs.forEach((item, idx) => {
    els.qaList.appendChild(makeQaRow("choice", idx, item.q || "", item.a || ""));
  });
  insertReorderHint("choice");     // <-- add here to show categories in Checkbox/Radio/Select filed Q@A
  wireRowHandlers("choice");
  wireDnD("choice");
}

function renderTextQA() {
  els.textQaList.innerHTML = "";
  state.textQaPairs.forEach((item, idx) => {
    els.textQaList.appendChild(makeQaRow("text", idx, item.q || "", item.a || ""));
  });
  // insertReorderHint("text");       // <-- add here to show categories in Text filed Q@A
  wireRowHandlers("text");
  wireDnD("text");
}



// ---- Drag & Drop reordering (with autosave) ----
function wireDnD(kind) {
  const container = kind === "choice" ? els.qaList : els.textQaList;

  // rows draggable
  [...container.querySelectorAll(".qa-row")].forEach(makeRowDraggable);

  // make ALL hints draggable (not just the first one)
  [...container.querySelectorAll(".reorder-hint")].forEach(makeHintDraggable);

  function makeRowDraggable(row) {
    row.setAttribute("draggable", "true");
    row.addEventListener("dragstart", (e) => {
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      // rebuild state from DOM order of rows (ignore hints)
      const rows = [...container.querySelectorAll(".qa-row")];
      const reordered = rows.map((r) => {
        const [qInp, aInp] = r.querySelectorAll("input");
        return { q: qInp.value, a: aInp.value };
      });
      if (kind === "choice") {
        state.qaPairs = reordered;
        renderChoiceQA();
      } else {
        state.textQaPairs = reordered;
        renderTextQA();
      }
      save(); // persist rows
    });
  }

  function makeHintDraggable(h) {
    h.addEventListener("dragstart", (e) => {
      h.classList.add("dragging-hint");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    });
    h.addEventListener("dragend", () => {
      h.classList.remove("dragging-hint");
      // compute this hint's index among rows+hints and save
      const items = [...container.querySelectorAll(".qa-row, .reorder-hint")];
      const idx = items.indexOf(h);
      const key = `${kind}_${h.dataset.hint}`; // e.g., "text_h2"
      chrome.storage.local.get({ hintPos: {} }, ({ hintPos }) => {
        hintPos[key] = idx;
        chrome.storage.local.set({ hintPos });
      });
      // No re-render here; we don't want to snap it back
    });
  }

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = container.querySelector(".qa-row.dragging") || container.querySelector(".reorder-hint.dragging-hint");
    if (!dragging) return;

    const after = getElementAfterY(container, e.clientY, dragging);
    if (after == null) container.appendChild(dragging);
    else container.insertBefore(dragging, after);
  });

  function getElementAfterY(container, y, draggingEl) {
    const candidates = [...container.querySelectorAll(".qa-row:not(.dragging), .reorder-hint:not(.dragging-hint)")];
    let closest = { offset: Number.NEGATIVE_INFINITY, el: null };
    for (const el of candidates) {
      const box = el.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) closest = { offset, el };
    }
    if (closest.el === draggingEl) return null;
    return closest.el;
  }
}


// ---------- Filler functions injected into the page ----------
// (1) Default text fields (Name/Email/Phone/Address/LinkedIn/GitHub/Summary)
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
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
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

// (2) User-defined TEXT Q&A
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

// (3) User-defined CHOICE Q&A (checkbox/radio/select)
function pageFillFn_CHOICES_ONLY(QA) {
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
      ["pointerdown", "mousedown", "mouseup", "click"].forEach(type =>
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
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

    function readSelectedText(container) {
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

    async function chooseValue(container, targetText) {
      if (setNativeSelect(container, targetText)) { return true; }
      if (setRadioOrCheckbox(container, targetText)) { return true; }
      return false;
    }

    if (!Array.isArray(QA) || QA.length === 0) return;

    const results = [];
    for (const pair of QA) {
      const q = pair?.q || pair?.[0];
      const ans = pair?.a || pair?.[1];
      if (!q || !ans) { results.push("—"); continue; }

      const c = findContainerStrict(q);
      if (!c) { results.push(`${q.slice(0, 22)}… ✗`); continue; }

      c.scrollIntoView({ block: "center" });
      await sleep(80);

      const ok = await chooseValue(c, ans);
      results.push(`${q.slice(0, 22)}… ${ok ? "✓" : "✗"}`);
      await sleep(120);
    }

    // tiny toast
    try {
      const id = "job-filler-toast";
      document.getElementById(id)?.remove();
      const t = document.createElement("div");
      t.id = id; t.textContent = results.join("  ");
      Object.assign(t.style, {
        position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
        background: "#111827", color: "#fff", padding: "8px 12px",
        borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
      });
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1800);
    } catch {}
  })();
}
function pageFillFn_SQDA_ONLY(sqda) {
  if (!Array.isArray(sqda)) return;

  function toL(s) { return (s || "").toLowerCase(); }

  sqda.forEach(group => {
    const questionText = toL(group.question);
    const answers = (group.answers || []).map(a => toL(a));

    // Search the document for matching question
    const allNodes = [...document.querySelectorAll("label, div, span, p, legend")];
    const questionNodes = allNodes.filter(n => n.innerText && toL(n.innerText).includes(questionText));

    if (!questionNodes.length) return;

    questionNodes.forEach(qNode => {
      // Find parent block containing the answer options
      const container = qNode.closest("fieldset, div, section, li") || qNode.parentElement;
      if (!container) return;

      // Try clicking radios/checkboxes
      const inputs = container.querySelectorAll("input[type='radio'], input[type='checkbox']");
      inputs.forEach(input => {
        let labelTxt = "";

        if (input.id) {
          const lbl = container.querySelector(`label[for='${CSS.escape(input.id)}']`);
          if (lbl) labelTxt = lbl.innerText.trim();
        }
        if (!labelTxt && input.closest("label")) {
          labelTxt = input.closest("label").innerText.trim();
        }

        const t = toL(labelTxt);

        // MATCH: if ANY SQDA answer matches option
        if (answers.some(a => t.includes(a))) {
          input.click();
        }
      });

      // Try clicking dropdowns
      const selects = container.querySelectorAll("select");
      selects.forEach(sel => {
        [...sel.options].forEach(opt => {
          const t = toL(opt.innerText);
          if (answers.some(a => t.includes(a))) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });
    });
  });
}

// ---------- Fill button orchestration ----------
// Runs: defaults -> TEXT Q&A -> CHOICE Q&A (same order as background listener)
async function fillOnPage() {
  chrome.storage.local.get(
    ["name","email","phone","address","linkedin","github","summary","qaPairs","textQaPairs","sqda"],
    async (data) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // 1) default text inputs
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

      // 3) user-defined CHOICE Q&A
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_CHOICES_ONLY,
        args: [Array.isArray(data.qaPairs) ? data.qaPairs : []]
      });

      // 4) SQDA auto-matching logic
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn_SQDA_ONLY,
        args: [Array.isArray(data.sqda) ? data.sqda : []]
      });


      els.fillBtn.textContent = "Filled ✓";
      setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
    }
  );
}


// ---------- Export / Import / Reset All ----------
els.exportBtn = document.getElementById("exportBtn");
els.importBtn = document.getElementById("importBtn");
els.resetBtn = document.getElementById("resetBtn");


// Export data
els.exportBtn.addEventListener("click", () => {
  chrome.storage.local.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "JobFillerData.json";
    a.click();
    URL.revokeObjectURL(url);

    // Change button text temporarily
    els.exportBtn.textContent = "Exported ✓";
    setTimeout(() => (els.exportBtn.textContent = "Export Data"), 1000);
  });
});

// Import data
els.importBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        chrome.storage.local.set(json, () => {
          els.importBtn.textContent = "Imported ✓";
          setTimeout(() => {
            els.importBtn.textContent = "Import Data";
            window.location.reload();
          }, 1000);
        });
      } catch {
        els.importBtn.textContent = "Invalid ✗";
        setTimeout(() => (els.importBtn.textContent = "Import Data"), 1000);
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

// ---------- Reset All Data ----------
els.resetBtn.addEventListener("click", () => {
  if (!confirm("This will delete all saved data (questions, answers, hints, etc.). Continue?")) return;

  chrome.storage.local.clear(() => {
    els.resetBtn.textContent = "Reset ✓";
    setTimeout(() => {
      els.resetBtn.textContent = "Reset All";
      window.location.reload();
    }, 1000);
  });
});

// ---------- Event wiring ----------
document.addEventListener("DOMContentLoaded", () => {

  // handle BOTH Add buttons for Choice Q/A
  document.querySelectorAll(".qa_add_btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".qa-row");
      const q = row.querySelector(".qa_new_q").value.trim();
      const a = row.querySelector(".qa_new_a").value.trim();
      if (!q || !a) return;

      state.qaPairs.push({ q, a });
      row.querySelector(".qa_new_q").value = "";
      row.querySelector(".qa_new_a").value = "";
      renderChoiceQA();
      save();
    });
  });

  function showPopupToast(message) {
  const toast = document.getElementById("popupToast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 1300);
}


  els.saveBtn.addEventListener("click", save);
  els.fillBtn.addEventListener("click", fillOnPage);

  // original TEXT Q/A add button
  els.tqa_add.addEventListener("click", addTextQA);

  // NEW: Save button inside CHOICE Q/A
  els.saveChoiceBtn.addEventListener("click", save);


  els.sqda_add_question.addEventListener("click", addSqdaQuestion);
  els.sqda_add_answer.addEventListener("click", addSqdaAnswer);
  els.saveSqdaBtn.addEventListener("click", saveSqdaInternal);

  // Floating ADD button → focus bottom add row
  // Floating ADD button → focus bottom add-row Question field
  document.getElementById("floatingAddOnly").addEventListener("click", () => {
    // Scroll to bottom smoothly
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

    setTimeout(() => {
      // Find all add rows that have input.qa_new_q
      const addRows = [...document.querySelectorAll(".qa-row")].filter(row =>
        row.querySelector(".qa_new_q")
      );

      // Bottom-most add row (your duplicate one)
      const lastAddRow = addRows[addRows.length - 1];

      if (lastAddRow) {
        const qInput = lastAddRow.querySelector(".qa_new_q");
        if (qInput) qInput.focus();
      }
    }, 250);
  });


  // Floating dual-button: Up + Down in one circle
  document.getElementById("btnUp").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    setTimeout(() => {
      const nameInput = document.getElementById("name");
      if (nameInput) nameInput.focus();
    }, 300);
  });

  document.getElementById("btnDown").addEventListener("click", () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

    setTimeout(() => {
      const rows = document.querySelectorAll(".qa-row");
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const qInput = lastRow.querySelector(".qa_new_q");
        if (qInput) qInput.focus();
      }
    }, 300);
  });

  /* ⭐⭐⭐ ADD THIS BLOCK RIGHT HERE — BEFORE load() ⭐⭐⭐ */

  // Auto-fill captured CHOICE Q/A question (Alt+4)
  chrome.storage.local.get("quickChoiceQuestion", ({ quickChoiceQuestion }) => {
  if (quickChoiceQuestion) {

    const addRows = [...document.querySelectorAll(".qa-row")].filter(row =>
      row.querySelector(".qa_new_q")
    );

    const bottomRow = addRows[addRows.length - 1];

    if (bottomRow) {
      const qField = bottomRow.querySelector(".qa_new_q");
      const aField = bottomRow.querySelector(".qa_new_a");

      // Set question + default answer
      // qField.value = quickChoiceQuestion;
      // if (aField) aField.value = "No";

      // Set question
      qField.value = quickChoiceQuestion;

      // Pull captured answer from storage
      chrome.storage.local.get("quickChoiceAnswer", ({ quickChoiceAnswer }) => {
        if (aField) {
          aField.value = quickChoiceAnswer || "";
        }
      });


      // ⭐ WAIT before clicking Add (needed because renderChoiceQA destroys DOM)
      setTimeout(() => {
        const freshRows = [...document.querySelectorAll(".qa-row")].filter(row =>
          row.querySelector(".qa_new_q")
        );

        const freshBottom = freshRows[freshRows.length - 1];
        const freshAddBtn = freshBottom?.querySelector(".qa_add_btn");

        if (freshAddBtn) {
          freshAddBtn.click();
          showPopupToast("Added ✓");

          // ⭐ Scroll to bottom ADD row after adding
          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

            // focus new bottom add row
            const addRows = [...document.querySelectorAll(".qa-row")].filter(row =>
              row.querySelector(".qa_new_q")
            );
            const lastAddRow = addRows[addRows.length - 1];

            if (lastAddRow) {
              const qInput = lastAddRow.querySelector(".qa_new_q");
              if (qInput) qInput.focus();
            }
          }, 200);
        }


      }, 120);
    }

    chrome.storage.local.set({ quickChoiceQuestion: "" });
    chrome.storage.local.set({ quickChoiceAnswer: "" });

  }
});



    chrome.storage.local.get("extractedDisabilityOptions", ({ extractedDisabilityOptions }) => {
  if (extractedDisabilityOptions && extractedDisabilityOptions.length) {

    // Create display area if not exists
    let box = document.getElementById("disabilityExtractBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "disabilityExtractBox";
      box.style.marginTop = "12px";
      box.style.padding = "10px";
      box.style.background = "#ecfdf5"; /* light green */
      box.style.border = "1px solid #10b981"; /* green */
      box.style.borderRadius = "6px";
      box.style.fontSize = "13px";
      box.style.color = "#065f46";
      document.body.prepend(box);
    }

    // Print options in list format
    box.innerHTML = `
      <b style="color:#047857;">Disability Status Options (Detected):</b>
      <ul style="margin-top:6px; padding-left:18px;">
        ${extractedDisabilityOptions.map(o =>
          `<li style="margin-bottom:4px;">${o}</li>`
        ).join("")}
      </ul>
    `;

    // Reset so it only shows once per shortcut
    chrome.storage.local.set({ extractedDisabilityOptions: [] });
  }
});


  // Load data after everything is wired
  load();
});


// ---------- Event wiring ----------
els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
els.tqa_add.addEventListener("click", addTextQA);

// NEW: Save button inside CHOICE Q/A card
els.saveChoiceBtn.addEventListener("click", save);

document.addEventListener("DOMContentLoaded", load);
