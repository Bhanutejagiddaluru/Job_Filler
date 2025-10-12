// Alt+2: inject a small function into ALL frames to paste today's date at the cursor or a date-like field.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "paste-date") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const dateFn = (fmt) => {
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

    // Try active element first
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      const start = active.selectionStart ?? active.value.length;
      const end = active.selectionEnd ?? active.value.length;
      setVal(active, active.value.slice(0, start) + out + active.value.slice(end));
      active.setSelectionRange?.(start + out.length, start + out.length);
      return;
    }
    if (active && active.isContentEditable) {
      document.execCommand("insertText", false, out);
      return;
    }

    // Otherwise try a likely date field
    const candidates = Array.from(document.querySelectorAll("input, textarea"))
      .filter((el) => {
        const p = (x) => (x || "").toLowerCase();
        const ph = p(el.placeholder), nm = p(el.name), id = p(el.id), ar = p(el.getAttribute("aria-label"));
        return /date|availability|start/i.test(ph + nm + id + ar);
      });
    if (candidates[0]) setVal(candidates[0], out);
  };

  // read user date format then inject into all frames
  chrome.storage.local.get({ dateFormat: "YYYY-MM-DD" }, async ({ dateFormat }) => {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: dateFn,
      args: [dateFormat]
    });
  });
});
