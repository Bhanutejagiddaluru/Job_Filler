const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),
  dateFormat: document.getElementById("dateFormat"),
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
  pasteDateBtn: document.getElementById("pasteDateBtn"),
};

// ---------- storage ----------
function load() {
  chrome.storage.local.get(
    {
      name: "",
      email: "",
      phone: "",
      address: "",
      linkedin: "",
      github: "",
      summary: "",
      dateFormat: "YYYY-MM-DD",
    },
    (res) => Object.entries(res).forEach(([k, v]) => { if (els[k]) els[k].value = v; })
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
      dateFormat: els.dateFormat.value,
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

// ---------- page filler ----------
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

  const allInputs = Array.from(document.querySelectorAll("input, textarea")).filter((el) => {
    const t = (el.type || "").toLowerCase();
    if (["button","submit","checkbox","radio","file","hidden"].includes(t)) return false;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
  });

  const find = (keys) =>
    allInputs.find((el) => {
      const check = (s) => (s || "").toLowerCase();
      const combined = [
        el.placeholder,
        el.name,
        el.id,
        el.getAttribute("aria-label"),
        (document.querySelector(`label[for="${el.id}"]`) || {}).textContent
      ].join(" ").toLowerCase();
      return keys.some((k) => combined.includes(k.toLowerCase()));
    });

  // Name (split if needed)
  const full = data.name || "";
  const [first, ...rest] = full.split(" ");
  const last = rest.join(" ");
  const firstEl = find(["first name", "fname"]);
  const lastEl = find(["last name", "lname", "surname"]);
  if (firstEl) setReactSafe(firstEl, first);
  if (lastEl) setReactSafe(lastEl, last);
  if (!firstEl && !lastEl) {
    const nameEl = find(["name", "full name"]);
    if (nameEl) setReactSafe(nameEl, full);
  }

  if (data.email)   setReactSafe(find(["email", "e-mail"]), data.email);
  if (data.phone)   setReactSafe(find(["phone", "mobile", "telephone"]), data.phone);
  if (data.address) setReactSafe(find(["address", "location", "street"]), data.address);
  if (data.linkedin) setReactSafe(find(["linkedin", "linkedin url", "social"]), data.linkedin);
  if (data.github)  setReactSafe(find(["github", "portfolio", "website", "personal site"]), data.github);
  if (data.summary) setReactSafe(find(["summary", "cover letter", "description", "bio"]), data.summary);

  window.scrollBy({ top: -60, behavior: "smooth" });
}

async function fillOnPage() {
  chrome.storage.local.get(
    ["name","email","phone","address","linkedin","github","summary"],
    async (data) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: fillFn,
        args: [data],
      });
      els.fillBtn.textContent = "Filled ✓";
      setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
    }
  );
}

// ---------- date ----------
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
        const out = fmt === "MM/DD/YYYY" ? `${mm}/${dd}/${yyyy}` :
                    fmt === "DD-MM-YYYY" ? `${dd}-${mm}-${yyyy}` :
                    `${yyyy}-${mm}-${dd}`;
        const el = document.activeElement;
        const setVal = (e, v) => {
          const proto = e.__proto__ || Object.getPrototypeOf(e);
          const desc = Object.getOwnPropertyDescriptor(proto, "value");
          const setter = desc && desc.set;
          if (setter) setter.call(e, v); else e.value = v;
          e.dispatchEvent(new Event("input", { bubbles: true }));
          e.dispatchEvent(new Event("change", { bubbles: true }));
        };
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          setVal(el, el.value.slice(0, start) + out + el.value.slice(end));
          el.setSelectionRange?.(start + out.length, start + out.length);
        }
      },
      args: [dateFormat],
    });
  });
  els.pasteDateBtn.textContent = "Pasted ✓";
  setTimeout(() => (els.pasteDateBtn.textContent = "Paste Today’s Date"), 900);
}

els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
els.pasteDateBtn.addEventListener("click", pasteDateNow);
document.addEventListener("DOMContentLoaded", load);
