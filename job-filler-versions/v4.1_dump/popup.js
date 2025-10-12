const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),
  // new compliance fields
  workAuthUS: document.getElementById("workAuthUS"),
  legalWorkCountry: document.getElementById("legalWorkCountry"),
  ageCategory: document.getElementById("ageCategory"),
  provideAuth3Days: document.getElementById("provideAuth3Days"),
  needSponsorship: document.getElementById("needSponsorship"),
  meetsMinQuals: document.getElementById("meetsMinQuals"),
  // buttons
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
};

// ---- storage ----
function load() {
  chrome.storage.local.get(
    {
      name: "", email: "", phone: "", address: "",
      linkedin: "", github: "", summary: "",
      workAuthUS: "", legalWorkCountry: "", ageCategory: "",
      provideAuth3Days: "", needSponsorship: "", meetsMinQuals: ""
    },
    (res) => {
      Object.entries(res).forEach(([k, v]) => {
        if (els[k] && "value" in els[k]) els[k].value = v;
      });
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
      workAuthUS: els.workAuthUS.value,
      legalWorkCountry: els.legalWorkCountry.value,
      ageCategory: els.ageCategory.value,
      provideAuth3Days: els.provideAuth3Days.value,
      needSponsorship: els.needSponsorship.value,
      meetsMinQuals: els.meetsMinQuals.value
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

// ---- in-page filler ----
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

  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  // filter visibles
  const inputs = qsa("input, textarea").filter((el) => {
    const t = (el.type || "").toLowerCase();
    if (["button","submit","file","hidden"].includes(t)) return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
  });
  const selects = qsa("select").filter((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
  });
  const radios = qsa('input[type="radio"]');
  const checks = qsa('input[type="checkbox"]');

  const labelTextFor = (el) => {
    if (!el) return "";
    const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (byFor) return (byFor.textContent || "").trim();
    let p = el.parentElement;
    while (p && p !== document.body) {
      if (p.tagName === "LABEL") return (p.textContent || "").trim();
      p = p.parentElement;
    }
    return "";
  };

  const textBag = (el) => {
    const join = (...xs) => xs.filter(Boolean).join(" ").toLowerCase();
    return join(
      el.placeholder, el.name, el.id, el.getAttribute("aria-label"),
      labelTextFor(el)
    );
  };

  const findInput = (keys) => inputs.find((el) => {
    const bag = textBag(el);
    return keys.some((k) => bag.includes(k.toLowerCase()));
  });
  const findSelect = (keys) => selects.find((el) => {
    const bag = textBag(el);
    return keys.some((k) => bag.includes(k.toLowerCase()));
  });

  // Radio/checkbox helpers (for Yes/No groups)
  function setChoice(keys, value) {
    if (!value) return;

    // 1) Try select dropdowns first
    const sel = findSelect(keys);
    if (sel) {
      const want = value.toLowerCase();
      const opts = Array.from(sel.options);
      const best = opts.find(o =>
        (o.textContent || "").toLowerCase().includes(want) ||
        (o.value || "").toLowerCase() === want
      );
      if (best) { sel.value = best.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return; }
    }

    // 2) Try radio groups (by shared name or by proximity/label)
    const radioCandidates = radios.filter((r) => {
      const bag = textBag(r);
      return keys.some((k) => bag.includes(k.toLowerCase())) ||
             keys.some((k) => (r.name || "").toLowerCase().includes(k.toLowerCase()));
    });

    if (radioCandidates.length) {
      // group by name
      const groups = new Map();
      radioCandidates.forEach(r => {
        const key = r.name || `id:${r.id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      });
      const want = value.toLowerCase(); // "yes"/"no"/"18 years..."
      for (const group of groups.values()) {
        // pick the radio whose label matches yes/no or chosen text
        const match = group.find(r => {
          const l = labelTextFor(r).toLowerCase();
          return l.includes(want) || (r.value || "").toLowerCase() === want;
        }) || group.find(r => {
          // sometimes radios have hidden values like true/false
          const v = (r.value || "").toLowerCase();
          if (want === "yes") return ["yes","y","true","1"].includes(v);
          if (want === "no") return ["no","n","false","0"].includes(v);
          return false;
        });
        if (match && !match.checked) {
          match.click();
          match.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      return;
    }

    // 3) Try checkboxes (rare for yes/no but sometimes used)
    const checkCandidates = checks.filter((c) => {
      const bag = textBag(c);
      return keys.some((k) => bag.includes(k.toLowerCase()));
    });
    if (checkCandidates.length) {
      const desired = value.toLowerCase() === "yes";
      checkCandidates.forEach(c => {
        if (c.checked !== desired) c.click();
      });
    }
  }

  // Text fields
  // Name split or single
  const full = (data.name || "").trim();
  const [first, ...rest] = full.split(/\s+/);
  const last = rest.join(" ");

  const findTextAndSet = (keys, val) => {
    if (!val) return;
    const el = findInput(keys);
    if (el) setReactSafe(el, val);
  };

  const firstEl = findInput(["first name","given name","fname"]);
  const lastEl  = findInput(["last name","surname","family name","lname"]);
  if (firstEl) setReactSafe(firstEl, first);
  if (lastEl)  setReactSafe(lastEl,  last);
  if (!firstEl && !lastEl) findTextAndSet(["name","full name","applicant name"], full);

  findTextAndSet(["email","e-mail"], data.email);
  findTextAndSet(["phone","mobile","tel","telephone"], data.phone);
  findTextAndSet(["address","street","location"], data.address);
  findTextAndSet(["linkedin","linkedin url","social"], data.linkedin);
  findTextAndSet(["github","portfolio","website","personal site"], data.github);
  findTextAndSet(["summary","cover letter","description","bio","about"], data.summary);

  // Yes/No/Select questions
  setChoice(
    ["authorized to work in the united states","work authorization","work authorized","us work authorization","us work eligible"],
    data.workAuthUS
  );
  setChoice(
    ["legally able to work","country where this job is located","work in the country"],
    data.legalWorkCountry
  );
  setChoice(
    ["age","age category","years of age","18 years"],
    data.ageCategory
  );
  setChoice(
    ["provide work authorization within 3 days", "3 days of your hire", "i-9 within 3 days"],
    data.provideAuth3Days
  );
  setChoice(
    ["require sponsorship","future sponsorship","now or in the future"],
    data.needSponsorship
  );
  setChoice(
    ["meet all minimum qualifications","minimum qualifications","qualifications for this job"],
    data.meetsMinQuals
  );

  // little toast
  try {
    const id = "job-filler-toast";
    document.getElementById(id)?.remove();
    const t = document.createElement("div");
    t.id = id; t.textContent = "✔ Form Filled";
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
    [
      "name","email","phone","address","linkedin","github","summary",
      "workAuthUS","legalWorkCountry","ageCategory",
      "provideAuth3Days","needSponsorship","meetsMinQuals"
    ],
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
