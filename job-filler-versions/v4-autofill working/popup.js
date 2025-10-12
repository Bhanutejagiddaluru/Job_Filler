const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
};

// ---- storage ----
function load() {
  chrome.storage.local.get(
    {
      name: "", email: "", phone: "", address: "",
      linkedin: "", github: "", summary: ""
    },
    (res) => {
      els.name.value = res.name;
      els.email.value = res.email;
      els.phone.value = res.phone;
      els.address.value = res.address;
      els.linkedin.value = res.linkedin;
      els.github.value = res.github;
      els.summary.value = res.summary;
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
      summary: els.summary.value
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

// ---- page filler (same as hotkey; injected to all frames) ----
function pageFillFn(data) {
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
        (document.querySelector(`label[for="${el.id}"]`) || {}).textContent
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

  // tiny on-page toast
  try {
    const id = "job-filler-toast";
    document.getElementById(id)?.remove();
    const t = document.createElement("div");
    t.id = id;
    t.textContent = "✔ Form Filled";
    Object.assign(t.style, {
      position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
      background: "#111827", color: "#fff", padding: "8px 12px",
      borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  } catch {}
}

async function fillOnPage() {
  chrome.storage.local.get(
    ["name","email","phone","address","linkedin","github","summary"],
    async (data) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: pageFillFn,
        args: [data]
      });
      els.fillBtn.textContent = "Filled ✓";
      setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
    }
  );
}

els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
document.addEventListener("DOMContentLoaded", load);
