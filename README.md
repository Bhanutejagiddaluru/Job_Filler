# Job Filler — Chrome Extension (Automate Your Job Application Forms) [Free](1), [Open Source](2)

- What you give, that will fill
- No cloud, no login, no setup. Just **fills.**

### 🚀 Story: Why I Built This

I was applying for jobs — tailoring my resume, checking ATS scores, tweaking keywords. Every. Single. Time. But then came the **real pain** — the actual job portals.

Even when the ATS already scanned my resume and *had my info*, they still asked for the same crap — name, email, phone number, education, experience — over and over. Some portals filled half of it, others nothing. **F**\* these job portals\*\* — I decided to build my own **Job Filler**.

The idea was simple:

> Whatever information I save once, the extension will fill automatically — no questions asked.

ChatGPT‑5 helped me set up the base structure of a Chrome Extension. Here’s how it evolved:

---

### 🧩 Phase 1 — Getting Started — Build Our Own Chrome Extension (Free)

**Files you need (only these):**

- `manifest.json` — extension config (permissions, hotkey).
- `popup.html` — small UI to enter/save info.
- `popup.js` — logic for saving/loading and triggering fill.
- `background.js` — listens for Alt+2 and injects code.
- `content.js` — DOM helpers used on the page.
- `icon.png` — optional, any 128×128 image.

**How to install (unpacked):**

1. Put all the above files in a single folder, e.g., `job-filler/`.
2. Open Chrome → address bar: `chrome://extensions/`.
3. Turn on the **Developer mode** toggle (top-right).
4. Click **Load unpacked** → select the `job-filler/` folder → Done.
5. When you change files later, click **Reload** on the extension card (or toggle it off/on). Your changes apply immediately.

That’s it — completely free and local.

---

### 🧠 Phase 2 — Filling Basic Inputs

At first, the form filler wasn’t working. I found that normal `.value` assignment doesn’t work for React/Angular sites because frameworks block direct DOM value changes.

**Solution:** Use the *React-safe setter* method:

```js
const proto = el.__proto__ || Object.getPrototypeOf(el);
const desc = Object.getOwnPropertyDescriptor(proto, "value");
const setter = desc && desc.set;
if (setter) setter.call(el, value);
else el.value = value;
el.dispatchEvent(new Event("input", { bubbles: true }));
el.dispatchEvent(new Event("change", { bubbles: true }));
```

This ensures every field updates as if a human typed it.

---

### ⌨️ Phase 3 — Adding Hotkey (Alt + 2)

Clicking the **Fill** button was boring. So I added a shortcut key — **Alt + 2** — to auto-fill instantly.

At first, the hotkey didn’t trigger. I tried So may different way, no use. So I built a tiny small application named **alt2-test**, whose only job was to confirm hotkey detection. when working nothing worked then find it we need to ass the value in the extension/shortcut after assigning it worked. After debugging permissions and commands in `manifest.json`, the hotkey finally worked.

Then I merged it back into Job Filler — success.

---

### 🧠 Phase 4 — The Checkbox filling

This was the main **sh\*tshow** — checkboxes and radio buttons didn’t fill. My first logic randomly clicked boxes, selecting wrong options.

It wouldn’t even enter the checkbox flow. After \~2 hours of digging, I fixed it by scoping everything to the **question container** and supporting shadow‑DOM.

I created a small helper project **checkbox\_filler** to debug how checkboxes and radio buttons behave. After testing, I realized the key was to keep every action inside its own question container. Using deep DOM traversal and label matching, I could locate the correct input and click it safely using simulated mouse events. (`pointerdown`, `mousedown`, `mouseup`, `click`).

**Final Version (Checkbox Filler):**

The latest version of `background.js` made the logic smarter and faster:
- It searches only inside relevant containers (ignoring navigation or banners).
- Runs deep shadow‑DOM scanning so every hidden or dynamic field is detected.
- Uses fast pre‑checks — if the page doesn’t have any matching questions or input controls, it exits instantly.
- For each question, it matches label text, then safely selects the right option (checkbox, radio, dropdown, or select) using simulated mouse clicks.
- Includes built‑in retry and verification so each filled answer is validated.

This version finally solved every edge case — no random clicks, no wrong gender selection, and instant exit if nothing to fill.

---

### ⚙️ Phase 5 — Smarter Algorithm

This phase refined the detection process using a more technical, data-driven approach. The system now uses a **DOM scoring algorithm** to locate the most accurate input container for each question.

**Process Overview:**
1. Traverse the document using a recursive **TreeWalker** that also scans **shadow DOM** nodes.
2. Identify potential containers (`<fieldset>`, `<section>`, `<div>`, or elements with `[role=group]`).
3. Assign a weighted score to each container based on proximity of text, visible size, and control presence (checkbox, select, or textarea).
4. Select the container with the highest confidence score.
5. Safely inject the user’s response by simulating native user input events (`input`, `change`, and synthetic mouse events for clicks).

**Pseudo Logic:**
```
for each (question, answer) in QA:
    container = findBestContainer(question)
    if container:
        target = locateInputOrControl(container)
        if target:
            safelyFill(target, answer)
```

If no matching question or control exists, the system performs an early exit to save time and prevent unnecessary DOM operations.

---

### 🧱 Phase 6 — User‑Added Q&A System

Instead of hardcoding everything, I added the ability for users to **add or remove questions and answers** inside the popup.

- Text Fields → "Additional information (from YOU)"
- Checkbox/Radio → "Q&A (from YOU)"

Everything saves locally using `chrome.storage.local`, so you never lose data.

---

### 🧠 Final Integration

- Fill **Text Inputs** → name, email, address, summary
- Fill **Text Q&A** → custom written answers
- Fill **Choice Q&A** → select boxes, radio, checkbox
- One‑click fill or **Alt+2** trigger

It works seamlessly across LinkedIn, Workday, Greenhouse, Lever, iCIMS, and other job portals.

---

### 🧩 Files Overview

| File            | Description                                             |
| --------------- | ------------------------------------------------------- |
| `manifest.json` | Chrome extension config (permissions, shortcuts)        |
| `popup.html`    | User interface for entering details & Q&A               |
| `popup.js`      | Handles data saving, loading, and triggering fill logic |
| `background.js` | Main logic for hotkey + page injection                  |
| `content.js`    | Helper for DOM manipulation (input detection)           |
| `icon.png`      | Extension icon                                          |

---

### 💾 Storage Behavior

All user data (name, Q&A, etc.) is stored in **Chrome Local Storage**, which persists until manually cleared or the extension is removed.

---

### ❤️ Built With

- **JavaScript (ES6)**
- **Chrome Extension MV3 API**
- **OpenAI ChatGPT‑5** (for logic and debugging help)

---

### 🏁 Result

In just **8 hours**, this small idea turned into a fully working **Job Application Filler**. No paid APIs, no bullshit — just local automation.

> Save once. Fill everywhere.

**#ThankYou OpenAI GPT‑5 🙏**



Version control and important information:

the version 20:  https://github.com/Bhanutejagiddaluru/Job_Filler/tree/main/job-filler-versions/V20

Implementated
1. Filling all most all forms, have save, load, reset form.
2. Change Question oder {Drag and drop}
3. Fixed Categories names, where order can change {drag and drop}
4. Auto Save when we add new question, or change of order only in select options



this version V21: https://github.com/Bhanutejagiddaluru/Job_Filler/tree/main/job-filler-versions/V21

Implementated
1. Updated Ui where keep the choice q/a top
2. add/save question kept at the top
3. add new question at bottom
4. page-up and page-down button
5. Add new question button

ths version V22: https://github.com/Bhanutejagiddaluru/Job_Filler/tree/main/job-filler-versions/V22

Implementated
1. Command "Alt+4" to auto trigger, by adding new question with defalt no.
2. Show the popup added

This is failed version v23.1 but have some implementation good:

Implementation:
1. Alt + 5, to show the disable status options, i want to know wheather we can able to read the options available in select choice q/a in the given website so i made this test it is working.
2. I changed the logic of Alt + 4, to paste the new question, answer need to paste from the selected choice Q/A. but this is not working.

