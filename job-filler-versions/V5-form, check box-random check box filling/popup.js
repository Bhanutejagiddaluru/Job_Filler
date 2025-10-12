const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  linkedin: document.getElementById("linkedin"),
  github: document.getElementById("github"),
  summary: document.getElementById("summary"),
  q_auth_us: document.getElementById("q_auth_us"),
  q_legal_location: document.getElementById("q_legal_location"),
  q_sponsorship: document.getElementById("q_sponsorship"),
  q_min_qual: document.getElementById("q_min_qual"),
  q_gender: document.getElementById("q_gender"),
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
};

// ---- storage ----
function load() {
  chrome.storage.local.get(
    {
      name: "", email: "", phone: "", address: "",
      linkedin: "", github: "", summary: "",
      q_auth_us: "skip",
      q_legal_location: "skip",
      q_sponsorship: "skip",
      q_min_qual: "skip",
      q_gender: "skip"
    },
    (res) => {
      els.name.value = res.name;
      els.email.value = res.email;
      els.phone.value = res.phone;
      els.address.value = res.address;
      els.linkedin.value = res.linkedin;
      els.github.value = res.github;
      els.summary.value = res.summary;
      els.q_auth_us.value = res.q_auth_us;
      els.q_legal_location.value = res.q_legal_location;
      els.q_sponsorship.value = res.q_sponsorship;
      els.q_min_qual.value = res.q_min_qual;
      els.q_gender.value = res.q_gender;
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
      q_auth_us: els.q_auth_us.value,
      q_legal_location: els.q_legal_location.value,
      q_sponsorship: els.q_sponsorship.value,
      q_min_qual: els.q_min_qual.value,
      q_gender: els.q_gender.value
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

// ---- page filler (same logic as background; injected to all frames) ----
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

  const visibleFilter = (el) => {
    const t = (el.type || "").toLowerCase();
    if (["button","submit","file","hidden"].includes(t)) return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };

  const inputs = Array.from(document.querySelectorAll("input, textarea")).filter(visibleFilter);
  const selects = Array.from(document.querySelectorAll("select")).filter(visibleFilter);

  const find = (keys) =>
    inputs.find((el) => {
      const combined = [
        el.placeholder, el.name, el.id, el.getAttribute("aria-label"),
        (document.querySelector(`label[for="${el.id}"]`) || {}).textContent
      ].join(" ").toLowerCase();
      return keys.some((k) => combined.includes(k.toLowerCase()));
    });

  // ---------- text fields ----------
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

  // ---------- compliance helpers ----------
  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

  function closestContainer(node) {
    return node.closest?.("section, fieldset, div, li, form, article, tr") || node;
  }

  function getLabelText(el) {
    if (!el) return "";
    // explicit <label for>
    if (el.id) {
      const lb = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lb?.textContent) return lb.textContent;
    }
    // wrapping label
    const wrap = el.closest("label");
    if (wrap?.textContent) return wrap.textContent;
    // parent text fallback
    const p = el.parentElement;
    return p?.textContent || "";
  }

  function findQuestionContainers(qText) {
    const qn = norm(qText);
    const nodes = Array.from(document.querySelectorAll("*"))
      .filter(n => {
        if (!(n instanceof HTMLElement)) return false;
        const txt = norm(n.textContent);
        if (!txt) return false;
        // require question phrase and at least one input/select nearby to reduce false positives
        if (!txt.includes(qn)) return false;
        const container = closestContainer(n);
        const hasControls = container.querySelector("input[type=radio], input[type=checkbox], select");
        return !!hasControls;
      });
    return nodes.map(n => closestContainer(n));
  }

  function setSelectByText(select, wanted) {
    const w = norm(wanted);
    let matched = false;
    for (const opt of select.options) {
      const t = norm(opt.textContent);
      if (t.includes(w)) {
        select.value = opt.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        matched = true;
        break;
      }
    }
    return matched;
  }

  function clickRadioOrCheckbox(container, wantedList) {
    const wanted = wantedList.map(norm);
    const inputs = Array.from(container.querySelectorAll("input[type=radio], input[type=checkbox]"));
    for (const inp of inputs) {
      const t = norm(getLabelText(inp));
      if (!t) continue;
      if (wanted.some(w => t.includes(w))) {
        if (!inp.checked) {
          inp.click?.();
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return true;
      }
    }
    return false;
  }

  function answerQuestion(questionText, answer) {
    const a = norm(answer);
    if (!a || a === "skip") return;

    const containers = findQuestionContainers(questionText);
    for (const c of containers) {
      // Try radios/checkboxes first
      const mapped = (ans) => {
        if (ans === "yes") return ["yes", "y", "i agree", "agree", "accept", "true"];
        if (ans === "no")  return ["no", "n", "decline", "disagree", "false"];
        if (ans === "male") return ["male", "man", "m"];
        if (ans === "female") return ["female", "woman", "f"];
        return [ans];
      };
      if (clickRadioOrCheckbox(c, mapped(a))) continue;

      // Then try <select>
      const sel = c.querySelector("select");
      if (sel) {
        if (a === "yes" || a === "no" || a === "male" || a === "female") {
          if (setSelectByText(sel, a)) continue;
        }
        // fallback—try a few common phrasings
        if (a === "yes" && setSelectByText(sel, "yes")) continue;
        if (a === "no"  && setSelectByText(sel, "no")) continue;
      }
    }
  }

  // ---------- apply compliance ----------
  // Authorized to work in the U.S.?
  if (data.q_auth_us) {
    answerQuestion("Authorized to work in the U.S.", data.q_auth_us);
    answerQuestion("Authorized to work in the United States", data.q_auth_us);
    answerQuestion("Work authorization", data.q_auth_us);
  }

  // Legally able to work where job is located?
  if (data.q_legal_location) {
    answerQuestion("Legally able to work where job is located", data.q_legal_location);
    answerQuestion("Legally able to work", data.q_legal_location);
  }

  // Sponsorship
  if (data.q_sponsorship) {
    answerQuestion("Will you now or in the future require sponsorship", data.q_sponsorship);
    answerQuestion("Require employer sponsorship", data.q_sponsorship);
  }

  // Minimum qualifications
  if (data.q_min_qual) {
    answerQuestion("Do you certify you meet all minimum qualifications", data.q_min_qual);
    answerQuestion("certify you meet all minimum qualifications", data.q_min_qual);
    answerQuestion("meet all minimum qualifications", data.q_min_qual);
  }

  // Gender
  if (data.q_gender) {
    answerQuestion("gender", data.q_gender);
    answerQuestion("sex", data.q_gender);
  }

  // ---------- toast ----------
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
    [
      "name","email","phone","address","linkedin","github","summary",
      "q_auth_us","q_legal_location","q_sponsorship","q_min_qual","q_gender"
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
