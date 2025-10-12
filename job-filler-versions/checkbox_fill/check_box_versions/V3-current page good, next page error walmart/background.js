// background.js (MV3)
// Make sure your manifest "commands" has a command named "fill-fixed" bound to Alt+2.
// Also ensure "permissions": ["scripting","activeTab"] are present.

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-fixed") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Inject a fully self-contained function (no outer-scope references!)
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      (async function () {
        // ===== All data + helpers live INSIDE this injected function =====

        // --- Questions & desired answers ---
        const QA = [
          ["Do you certify you meet all minimum qualifications for this job as outlined in the job posting?", "Yes"],
          ["Would you like to receive mobile text message updates relating to your employment relationship with Walmart? If so, choose to Opt-in below.", "Opt-Out from receiving text messages"],
          ["Are you legally able to work in the country where this job is located?", "Yes"],
          ["Please select your age category:", "18 years of age and Over"],
          ["Please select your Walmart Associate Status/Affiliation:", "Have never been an employee of Walmart Inc or any of its subsidiaries"],
          ["Are you able to provide work authorization within 3 days of your hire?", "Yes"],
          ["Will you now or in the future require \"sponsorship for an immigration-related employment benefit\"?", "Yes"],
          ["If yes, please choose the type of sponsorship from the below list:", "H1-B"],
          ["Do you have Active Duty or Guard/Reserve experience in the Uniformed Services of the United States?", "No"],
          ["Are you the Spouse/Partner of someone in the Uniformed Services of the United States?", "No"],
          ["Do you have a direct family member who currently works for Walmart or Sam's Club?", "No"],
          ["Please select your ethnicity.", "Asian"],
          ["Please select your gender", "Male"],
          ["Yes, I have read and consent to the Terms and Conditions", "Yes"],
        ];

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

        function isYesText(s) { const t = toL(s); return t === "yes" || t === "y" || t.startsWith("yes"); }
        function isNoText(s)  { const t = toL(s); return t === "no"  || t === "n" || t.startsWith("no"); }
        function matchesAnswer(text, target) {
          const a = toL(text);
          const b = toL(target);
          if (isYesText(b)) return isYesText(a);
          if (isNoText(b))  return isNoText(a);
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

            const hasControl = !!el.querySelector('select, input[type="radio"], input[type="checkbox"], [role="combobox"], [aria-haspopup="listbox"], [data-automation-id="selectBox"], [data-automation-id="select-selectedOption"]');
            const inNav = !!el.closest('header, nav, [role="navigation"], .nav, .navbar');

            const score =
              (hasControl ? 10 : 0) +
              (el.tagName === "FIELDSET" ? 3 : /SECTION|DIV|LI/.test(el.tagName) ? 2 : 1) +
              (inNav ? -10 : 0);

            if (score > bestScore) { best = el; bestScore = score; }
          }
          return best;
        }

        function readSelectedText(container) {
          const a = queryAllDeep('[data-automation-id="select-selectedOption"]', container)[0];
          if (a?.textContent) return a.textContent.trim();

          const b = queryAllDeep('[data-automation-id="select-selectedOptionLabel"]', container)[0];
          if (b?.textContent) return b.textContent.trim();

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

        function openDropdown(container) {
          const trigger =
            queryAllDeep('[data-automation-id="selectBox"]', container)[0] ||
            queryAllDeep('[data-automation-id="select-selectedOption"]', container)[0] ||
            queryAllDeep('button[aria-haspopup="listbox"]', container)[0] ||
            queryAllDeep('[aria-haspopup="listbox"]', container)[0] ||
            queryAllDeep('[role="combobox"]', container)[0] ||
            queryAllDeep('select', container)[0];

          if (!trigger || !visible(trigger)) return null;
          trigger.scrollIntoView({ block: "center" });
          trigger.focus?.();
          realClick(trigger);
          return trigger;
        }

        function clickTargetFromOpenList(targetText) {
          const options = queryAllDeep('[data-automation-id="select-option"], [role="option"]', document);
          const node = options.find(o => visible(o) && matchesAnswer((o.textContent || "").trim(), targetText));
          if (!node) return false;
          const opt = node.closest('[role="option"], [data-automation-id="select-option"]') || node;
          opt.scrollIntoView({ block: "center" });
          realClick(opt);
          return true;
        }

        async function typeThenEnter(targetText) {
          const el = document.activeElement;
          if (!el) return false;
          const role = el.getAttribute("role");
          const isEditable = role === "combobox" || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
          if (!isEditable) return false;

          el.focus();
          if ("value" in el) {
            el.value = "";
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.value = targetText;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await sleep(80);
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
          await sleep(140);
          return true;
        }

        async function chooseValue(container, targetText) {
          try {
            if (setNativeSelect(container, targetText)) { await sleep(100); return matchesAnswer(readSelectedText(container), targetText); }
            if (setRadioOrCheckbox(container, targetText)) { await sleep(100); return matchesAnswer(readSelectedText(container), targetText); }

            const trigger = openDropdown(container);
            if (!trigger) return false;
            await sleep(160);

            let acted = clickTargetFromOpenList(targetText);
            if (!acted) { await sleep(180); acted = clickTargetFromOpenList(targetText); }
            if (!acted) { acted = await typeThenEnter(targetText); }

            if (acted) {
              await sleep(160);
              trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
              trigger.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
            }

            await sleep(220);
            let v = readSelectedText(container);
            if (matchesAnswer(v, targetText)) return true;

            // one retry
            realClick(trigger);
            await sleep(160);
            clickTargetFromOpenList(targetText);
            await sleep(200);
            v = readSelectedText(container);
            return matchesAnswer(v, targetText);
          } catch (e) {
            console.warn("chooseValue error:", e);
            return false;
          }
        }

        function toast(text) {
          if (window.top !== window) return;
          try {
            const id = "autofill_toast";
            document.getElementById(id)?.remove();
            const t = document.createElement("div");
            t.id = id; t.textContent = text;
            Object.assign(t.style, {
              position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
              background: "#0f766e", color: "#fff", padding: "8px 12px",
              borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
            });
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 2000);
          } catch {}
        }

        // ---- main runner (per frame) ----
        const results = [];
        for (const [q, ans] of QA) {
          const c = findContainerStrict(q);
          if (!c) { results.push(`${q.slice(0, 22)}… ✗`); continue; }
          const ok = await chooseValue(c, ans);
          results.push(`${q.slice(0, 22)}… ${ok ? "✓" : "✗"}`);
          await sleep(120);
        }

        if (window.top === window) toast(results.join("  "));
      })().catch(err => {
        try {
          const id = "autofill_toast_err";
          document.getElementById(id)?.remove();
          const t = document.createElement("div");
          t.id = id; t.textContent = "Autofill error: " + (err?.message || err);
          Object.assign(t.style, {
            position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
            background: "#b91c1c", color: "#fff", padding: "8px 12px",
            borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
          });
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 3500);
        } catch {}
        console.warn("Injected autofill crashed:", err);
      });
    }
  });

  if (chrome.runtime.lastError) {
    console.warn("executeScript error:", chrome.runtime.lastError);
  }
});
