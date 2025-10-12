// ---------- helpers ----------
function formatDate(date, fmt) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  switch ((fmt || "YYYY-MM-DD").toUpperCase()) {
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "DD-MM-YYYY": return `${dd}-${mm}-${yyyy}`;
    default: return `${yyyy}-${mm}-${dd}`;
  }
}

// Set value in a way React/Angular/Vue detect
function setReactSafeValue(el, value) {
  const proto = el.__proto__ || Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = desc && desc.set;
  if (setter) setter.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function tryInsertAtCursor(text) {
  const el = document.activeElement;
  if (!el) return;

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    setReactSafeValue(el, before + text + after);
    el.setSelectionRange?.(start + text.length, start + text.length);
    return true;
  }
  if (el.isContentEditable) {
    document.execCommand("insertText", false, text);
    return true;
  }
  return false;
}

// Find inputs by label/placeholder/name/aria-label
function queryField(predicates) {
  const inputs = Array.from(
    document.querySelectorAll('input, textarea, [contenteditable=""], [contenteditable="true"]')
  );

  function norm(s) { return (s || "").toLowerCase().trim(); }

  // Map label->input via for/id or wrapping
  const labels = Array.from(document.querySelectorAll("label"));
  const labelMap = new Map();
  labels.forEach((lb) => {
    const text = norm(lb.textContent);
    const forId = lb.getAttribute("for");
    if (forId) {
      const target = document.getElementById(forId);
      if (target) labelMap.set(target, text);
    } else {
      const control = lb.querySelector("input, textarea, [contenteditable]");
      if (control) labelMap.set(control, text);
    }
  });

  const candidates = inputs.filter((el) => {
    const t = norm(el.type);
    if (t && ["button", "submit", "checkbox", "radio", "file"].includes(t)) return false;

    const meta = {
      tag: norm(el.tagName),
      name: norm(el.getAttribute?.("name")),
      id: norm(el.id),
      placeholder: norm(el.getAttribute?.("placeholder")),
      aria: norm(el.getAttribute?.("aria-label")),
      label: norm(labelMap.get(el))
    };
    return predicates.some((p) => p(meta));
  });

  // Prefer visible & larger width
  const visible = candidates.filter((el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== "hidden";
  });

  return visible[0] || candidates[0] || null;
}

function fillField(value, keys) {
  if (!value) return;
  const preds = keys.map((k) => {
    const kw = k.toLowerCase();
    return (m) =>
      (m.name && m.name.includes(kw)) ||
      (m.id && m.id.includes(kw)) ||
      (m.placeholder && m.placeholder.includes(kw)) ||
      (m.aria && m.aria.includes(kw)) ||
      (m.label && m.label.includes(kw));
  });
  const el = queryField(preds);
  if (!el) return;

  if (el.isContentEditable) {
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, value);
  } else {
    setReactSafeValue(el, value);
  }
}

// ---------- message handlers ----------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PASTE_DATE") {
    chrome.storage.local.get({ dateFormat: "YYYY-MM-DD" }, (res) => {
      const out = formatDate(new Date(), res.dateFormat);
      if (!tryInsertAtCursor(out)) {
        // If cursor method failed, try to find a likely date field
        fillField(out, ["date"]);
      }
    });
  }

  if (msg?.type === "FILL_FORM" && msg.payload) {
    const d = msg.payload;

    // Common field keys per value
    fillField(d.name,    ["Name*", "Name *", "Name", "name", "full name", "first name", "last name", "applicant name"]);
    fillField(d.email,   ["email", "e-mail"]);
    fillField(d.phone,   ["phone", "mobile", "telephone"]);
    fillField(d.address, ["address", "street", "location"]);
    fillField(d.summary, ["summary", "about", "cover letter", "description"]);

    // Optionally scroll to top so user sees changes
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});
