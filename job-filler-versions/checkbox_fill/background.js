// background.js (MV3)
// Requires manifest "permissions": ["scripting", "activeTab"], and "commands"->"fill-fixed" bound to Alt+2.

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-fixed") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      (async function () {
        // ================== DATA ==================
        const QA = [
          ["This role is based out of our", "Yes"],
          ["Are you able to commute to our", "Yes"],
          ["How many years of hands-on experience", "2-4 years"],
          ["Have you built \"and shipped an ML system to production users with measurable business impact?\"", "Yes"],
          ["Do you certify you meet all minimum qualifications for this job as outlined in the job posting?", "Yes"],
          ["Are you currently authorized to work in the United States?", "Yes"],
          ["Would you like to receive mobile text message updates relating to your employment relationship with Walmart? If so, choose to Opt-in below.", "Opt-Out from receiving text messages"],
          ["Are you legally able to work in the country where this job is located?", "Yes"],
          ["Please select your age category:", "18 years of age and Over"],
          ["Please select your Walmart Associate Status/Affiliation:", "Have never been an employee of Walmart Inc or any of its subsidiaries"],
          ["Are you able to provide work authorization within 3 days of your hire?", "Yes"],
          ["Will you now or in the future require \"sponsorship for an immigration-related employment benefit\"?", "No"],
          ["If yes, please choose the type of sponsorship from the below list:", "H1-B"],
          ["Do you have Active Duty or Guard/Reserve experience in the Uniformed Services of the United States?", "No"],
          ["Are you the Spouse/Partner of someone in the Uniformed Services of the United States?", "No"],
          ["Do you have a direct family member who currently works for Walmart or Sam's Club?", "No"],
          ["Please select your ethnicity.", "Asian"],
          ["Please select your gender", "Male"],
          ["Yes, I have read and consent to the Terms and Conditions", "Yes"],
        ];

        // ================== HELPERS ==================
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const toL = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
        const inNav = (el) => !!el?.closest?.('header, nav, [role="navigation"], [role="banner"], .nav, .navbar');

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

        // --- Gender-specific boundary-aware match (prevents "female" matching "male")
        function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
        function wordBoundaryHas(hay, needle){
          const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:$|[^a-z0-9])`, "i");
          return re.test(hay);
        }
        function isGenderToken(s){
          const t = toL(s);
          return t === "male" || t === "female" || t === "man" || t === "woman" ||
                 t === "non-binary" || t === "nonbinary" || t === "other" ||
                 t === "prefer not to say" || t === "prefer not to answer";
        }

        function matchesAnswer(text, target) {
          const a = toL(text), b = toL(target);
          if (isGenderToken(b)) return wordBoundaryHas(a, b);
          if (isYesText(b)) return isYesText(a);
          if (isNoText(b))  return isNoText(a);
          return a === b || a.includes(b) || b.includes(a);
        }

        // ======== NEW: cheap page-level prechecks ========
        function countCandidateControls() {
          // "Controls" we can actually act upon (and not inside nav/header)
          return queryAllDeep(`
            select,
            input[type="radio"],
            input[type="checkbox"],
            [role="combobox"],
            [aria-haspopup="listbox"],
            [role="radiogroup"],
            [data-automation-id="selectBox"],
            [data-automation-id="select-selectedOption"]
          `).filter(el => !inNav(el)).length;
        }

        const PAGE_TXT = toL(document.body?.innerText || document.body?.textContent || "");
        function pageHasQuestionText(q) {
          // Fast substring check to avoid per-question 5s waits
          const needle = toL(q);
          return !!needle && PAGE_TXT.includes(needle);
        }

        // Wait for a question container to actually mount (handles SPA page changes)
        async function waitForContainer(question, timeoutMs = 5000) {
          const start = performance.now();
          let container = null;
          while (performance.now() - start < timeoutMs) {
            container = findContainerStrict(question);
            if (container) return container;
            await sleep(150);
          }
          return null;
        }

        function findContainerStrict(question) {
          const needle = toL(question);
          if (!needle) return null;
          const candidates = queryAllDeep('fieldset, section, div, li, [role="group"], [role="radiogroup"], [data-automation-id]');
          let best = null, bestScore = -1;

          for (const el of candidates) {
            const text = toL(el.textContent || "");
            if (!text.includes(needle)) continue;
            if (inNav(el)) continue;

            const hasControl = !!el.querySelector(
              'select, input[type="radio"], input[type="checkbox"], [role="combobox"], [aria-haspopup="listbox"], [data-automation-id="selectBox"], [data-automation-id="select-selectedOption"]'
            );

            const rect = el.getBoundingClientRect();
            const areaScore = rect ? Math.max(0, 200000 - (rect.width * rect.height)) / 50000 : 0;

            const score =
              (hasControl ? 10 : 0) +
              (el.tagName === "FIELDSET" ? 3 : /SECTION|DIV|LI/.test(el.tagName) ? 2 : 1) +
              areaScore;

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
          const triggers = [
            ...queryAllDeep('[data-automation-id="selectBox"]', container),
            ...queryAllDeep('[data-automation-id="select-selectedOption"]', container),
            ...queryAllDeep('button[aria-haspopup="listbox"]', container),
            ...queryAllDeep('[aria-haspopup="listbox"]', container),
            ...queryAllDeep('[role="combobox"]', container),
            ...queryAllDeep('select', container),
          ].filter(t => !inNav(t));

          const trigger = triggers[0] || null;
          if (!trigger || !visible(trigger)) return null;
          trigger.scrollIntoView({ block: "center" });
          trigger.focus?.();
          realClick(trigger);
          return trigger;
        }

        // Option picker tied to the just-opened trigger
        function clickTargetFromOpenList(trigger, targetText) {
          const tRect = trigger.getBoundingClientRect();
          const tCx = tRect.left + tRect.width / 2;
          const tCy = tRect.top + tRect.height / 2;

          const options = queryAllDeep('[data-automation-id="select-option"], [role="option"]', document);
          const candidates = options
            .map(o => {
              const r = o.getBoundingClientRect();
              const cx = r.left + r.width / 2;
              const cy = r.top + r.height / 2;
              const dist = Math.hypot(cx - tCx, cy - tCy);
              return { o, dist, text: (o.textContent || "").trim() };
            })
            .filter(x => matchesAnswer(x.text, targetText))
            .sort((a, b) => a.dist - b.dist);

          if (!candidates.length) return false;
          const optEl = candidates[0].o.closest('[role="option"], [data-automation-id="select-option"]') || candidates[0].o;
          optEl.scrollIntoView({ block: "center" });
          realClick(optEl);
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

            let acted = clickTargetFromOpenList(trigger, targetText);
            if (!acted) { await sleep(180); acted = clickTargetFromOpenList(trigger, targetText); }
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
            clickTargetFromOpenList(trigger, targetText);
            await sleep(200);
            v = readSelectedText(container);
            return matchesAnswer(v, targetText);
          } catch (e) {
            console.warn("chooseValue error:", e);
            return false;
          }
        }

        function toast(text, ok=true) {
          if (window.top !== window) return;
          try {
            const id = "autofill_toast";
            document.getElementById(id)?.remove();
            const t = document.createElement("div");
            t.id = id; t.textContent = text;
            Object.assign(t.style, {
              position: "fixed", top: "12px", right: "12px", zIndex: 2147483647,
              background: ok ? "#0f766e" : "#b91c1c", color: "#fff", padding: "8px 12px",
              borderRadius: "8px", font: "12px system-ui", boxShadow: "0 4px 12px rgba(0,0,0,.25)"
            });
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 2200);
          } catch {}
        }

        // ================== MAIN ==================

        // ---- NEW: bail-out if page clearly has no actionable controls
        if (countCandidateControls() === 0) {
          // Optional: also check if page text lacks every question (extra safety)
          const anyQuestionOnPage = QA.some(([q]) => pageHasQuestionText(q));
          if (!anyQuestionOnPage) {
            if (window.top === window) toast("No matching questions/controls on this page — exiting.", false);
            return; // EXIT EARLY
          }
        }

        // We got here => either there ARE controls, or at least one question appears in page text.
        const results = [];

        for (const [q, ans] of QA) {
          // ---- NEW: per-question fast skip if text isn't on the page
          if (!pageHasQuestionText(q)) {
            results.push(`${q.slice(0, 22)}… —`);
            continue; // no 5s wait
          }

          // Otherwise, wait up to 5s for the specific container (SPA transitions)
          const c = await waitForContainer(q, 5000);
          if (!c) { results.push(`${q.slice(0, 22)}… ✗`); continue; }

          // Work in view for stability
          c.scrollIntoView({ block: "center" });
          await sleep(80);

          const ok = await chooseValue(c, ans);
          results.push(`${q.slice(0, 22)}… ${ok ? "✓" : "✗"}`);
          await sleep(140);
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
