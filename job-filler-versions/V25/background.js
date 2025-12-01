// ==============================
// Simple Job Filler - background.js
// - Only handles 2 fixed questions
// - Alt+2 => fill both answers
// ==============================

// Listen for keyboard commands (Alt+2 -> "fill-form" in manifest)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-form") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Inject the page script that fills the two questions
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: fillFixedQuestionsOnPage
  });
});

// This function runs INSIDE the job application page
function fillFixedQuestionsOnPage() {
  const QA = [
    {
      question: "Are you able to work onsite in Palo Alto, CA, 5 days per week?",
      answer: "No"
    },
    {
      question: "Are you willing to work 3+ days per week out of our San Francisco, CA office?",
      answer: "Yes"
    },
    {
      question: "Will you now or in the future require sponsorship for employment visa status (e.g., H-1B, O-1, TN, etc.)?",
      answer: "No"
    }
    
  ];

  const toL = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };

  function realClick(el) {
    if (!el) return;
    ["pointerdown", "mousedown", "mouseup", "click"].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }

  // Find the best element that contains the question text
  function findQuestionContainer(questionText) {
    const needle = toL(questionText);
    if (!needle) return null;

    const candidates = Array.from(
      document.querySelectorAll("label, legend, p, span, div, h3, h4")
    ).filter(visible);

    let bestMatch = null;
    let bestScore = -1;

    for (const el of candidates) {
      const txt = toL(el.textContent || "");
      if (!txt.includes(needle)) continue;

      // Prefer shorter chunks of text (less noise)
      const score = 1 / (1 + txt.length);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    }

    if (!bestMatch) return null;

    // Go up to a reasonable "question block" container
    return bestMatch.closest("fieldset, section, div, li") || bestMatch;
  }

  // Given a container and "Yes"/"No", try to select that answer
  function chooseAnswerInContainer(container, answerText) {
    if (!container) return false;
    const answerL = toL(answerText);

    // 1) Try radio buttons / checkboxes
    const inputs = Array.from(
      container.querySelectorAll('input[type="radio"], input[type="checkbox"]')
    );

    if (inputs.length) {
      for (const input of inputs) {
        let labelText = "";

        if (input.id) {
          const lab = container.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (lab) labelText = lab.textContent || "";
        }
        if (!labelText) {
          const lab = input.closest("label");
          if (lab) labelText = lab.textContent || "";
        }

        const labelL = toL(labelText);
        if (!labelL) continue;

        // Basic match: "yes" or "no" inside label text
        if (answerL === "yes" && labelL.includes("yes")) {
          if (!input.checked) {
            input.scrollIntoView({ block: "center" });
            realClick(input);
          }
          return true;
        }
        if (answerL === "no" && labelL.includes("no")) {
          if (!input.checked) {
            input.scrollIntoView({ block: "center" });
            realClick(input);
          }
          return true;
        }
      }
    }

    // 2) Try <select> dropdowns
    const select = container.querySelector("select");
    if (select) {
      let chosenIndex = -1;
      for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        const txt = toL(opt.text || opt.value || "");
        if (answerL === "yes" && txt.includes("yes")) {
          chosenIndex = i;
          break;
        }
        if (answerL === "no" && txt.includes("no")) {
          chosenIndex = i;
          break;
        }
      }
      if (chosenIndex >= 0) {
        select.selectedIndex = chosenIndex;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.scrollIntoView({ block: "center" });
        return true;
      }
    }

    // 3) Try simple buttons or role="radio"/"option" inside the container
    const clickable = Array.from(
      container.querySelectorAll('button, [role="radio"], [role="option"], [role="button"]')
    ).filter(visible);

    for (const el of clickable) {
      const txt = toL(el.textContent || "");
      if (!txt) continue;

      if (answerL === "yes" && txt.includes("yes")) {
        el.scrollIntoView({ block: "center" });
        realClick(el);
        return true;
      }
      if (answerL === "no" && txt.includes("no")) {
        el.scrollIntoView({ block: "center" });
        realClick(el);
        return true;
      }
    }

    return false;
  }

  // Fill both fixed questions
  QA.forEach(({ question, answer }) => {
    const container = findQuestionContainer(question);
    if (container) {
      chooseAnswerInContainer(container, answer);
    }
  });
}
