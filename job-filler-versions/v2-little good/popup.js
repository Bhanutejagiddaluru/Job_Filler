const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  summary: document.getElementById("summary"),
  dateFormat: document.getElementById("dateFormat"),
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
  pasteDateBtn: document.getElementById("pasteDateBtn"),
};

function load() {
  chrome.storage.local.get(
    { name: "", email: "", phone: "", address: "", summary: "", dateFormat: "YYYY-MM-DD" },
    (res) => {
      Object.entries(res).forEach(([k, v]) => { if (els[k]) els[k].value = v; });
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
      summary: els.summary.value,
      dateFormat: els.dateFormat.value,
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

function fillFn(data) {
  const norm = (s) => (s || "").toLowerCase().trim();

  const setReactSafe = (el, value) => {
    if (!el) return;
    const proto = el.__proto__ || Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = desc && desc.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // Prefer visible text inputs/textareas
  const allInputs = Array.from(document.querySelectorAll("input, textarea")).filter((el) => {
    const t = (el.type || "").toLowerCase();
    if (["button","submit","checkbox","radio","file","hidden"].includes(t)) return false;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
  });

  const match = (el, keys) => {
    const s = (x) => norm(x);
    const ph = s(el.placeholder), nm = s(el.name), id = s(el.id), ar = s(el.getAttribute("aria-label"));
    const lbl = (() => {
      // find associated label text
      const forId = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forId) return s(forId.textContent);
      let p = el.parentElement;
      while (p && p !== document.body) { // check wrapped labels
        if (p.tagName === "LABEL") return s(p.textContent);
        p = p.parentElement;
      }
      return "";
    })();
    const hay = ph + " " + nm + " " + id + " " + ar + " " + lbl;
    return keys.some((k) => hay.includes(s(k)));
  };

  const find = (keys) => allInputs.find((el) => match(el, keys));

  // Split full name into first/last if possible
  const full = (data.name || "").trim();
  let first = "", last = "";
  if (full) {
    const parts = full.split(/\s+/);
    first = parts[0] || "";
    last = parts.slice(1).join(" ") || "";
  }

  // Try First/Last variants (Ashby forms often split name)
  const firstEl = find(["first name", "given name", "fname"]);
  const lastEl  = find(["last name", "surname", "family name", "lname"]);

  if (firstEl || lastEl) {
    if (firstEl) setReactSafe(firstEl, first);
    if (lastEl)  setReactSafe(lastEl,  last);
  } else {
    // fallback single "Name"
    const nameEl = find(["name", "full name", "applicant name"]);
    if (nameEl) setReactSafe(nameEl, full);
  }

  const emailEl   = find(["email", "e-mail"]);
  const phoneEl   = find(["phone", "mobile", "tel", "telephone"]);
  const addrEl    = find(["address", "street", "location"]);
  const summaryEl = find(["summary", "about", "cover letter", "description", "bio"]);

  if (emailEl)   setReactSafe(emailEl, data.email || "");
  if (phoneEl)   setReactSafe(phoneEl, data.phone || "");
  if (addrEl)    setReactSafe(addrEl,  data.address || "");
  if (summaryEl) setReactSafe(summaryEl, data.summary || "");

  // Scroll a little so changes are visible
  window.scrollBy({ top: -60, behavior: "smooth" });
}

async function fillOnPage() {
  chrome.storage.local.get(["name","email","phone","address","summary"], async (data) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillFn,
      args: [data]
    });
    els.fillBtn.textContent = "Filled ✓";
    setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
  });
}

async function pasteDateNow() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.storage.local.get({ dateFormat: "YYYY-MM-DD" }, async ({ dateFormat }) => {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (fmt) => {
        const pad = (n) => String(n).padStart(2, "0");
        const d = new Date();
        const yyyy = d.getFullYear(), mm = pad(d.getMonth() + 1), dd = pad(d.getDate());
        const out = (fmt || "YYYY-MM-DD").toUpperCase() === "MM/DD/YYYY" ? `${mm}/${dd}/${yyyy}`
                 : (fmt || "YYYY-MM-DD").toUpperCase() === "DD-MM-YYYY" ? `${dd}-${mm}-${yyyy}`
                 : `${yyyy}-${mm}-${dd}`;

        const active = document.activeElement;
        const setVal = (el, v) => {
          const proto = el.__proto__ || Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, "value");
          const setter = desc && desc.set;
          if (setter) setter.call(el, v); else el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };

        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
          const start = active.selectionStart ?? active.value.length;
          const end = active.selectionEnd ?? active.value.length;
          setVal(active, active.value.slice(0, start) + out + active.value.slice(end));
          active.setSelectionRange?.(start + out.length, start + out.length);
          return;
        }
        if (active && active.isContentEditable) { document.execCommand("insertText", false, out); return; }

        const guess = Array.from(document.querySelectorAll("input, textarea"))
          .find((el) => /date|availability|start/i.test(
            (el.placeholder||"") + (el.name||"") + (el.id||"") + (el.getAttribute("aria-label")||"")
          ));
        if (guess) setVal(guess, out);
      },
      args: [dateFormat]
    });
  });

  els.pasteDateBtn.textContent = "Pasted ✓";
  setTimeout(() => (els.pasteDateBtn.textContent = "Paste Today’s Date"), 900);
}

els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
els.pasteDateBtn.addEventListener("click", pasteDateNow);
document.addEventListener("DOMContentLoaded", load);
