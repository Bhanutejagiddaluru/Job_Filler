// ---- Shortcut helper: nudge user to set Alt+2 once for unpacked extensions ----
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

// ---- Shared fill function injected into the page ----
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

  // Name: split first/last if separate fields exist
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

  // optional: quick visual confirmation (tiny toast)
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

// ---- Hotkey: Alt+2 always fills the form ----
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-form") return;

  // clear any "SET" badge once user used the shortcut
  await chrome.action.setBadgeText({ text: "" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const data = await chrome.storage.local.get([
    "name","email","phone","address","linkedin","github","summary"
  ]);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: pageFillFn,
    args: [data]
  });
});
