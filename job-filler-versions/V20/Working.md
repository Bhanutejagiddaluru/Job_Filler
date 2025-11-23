# The whole logic of the code and Algorithms

# where the file contain few files

- `manifest.json` — Defines how Chrome loads your extension
Key points:
"storage" → save your data permanently.
"activeTab" + "scripting" → run scripts on the open page.
"Alt+2" → triggers autofill globally.
"popup.html" → UI when clicking the extension icon.



- `popup.html` — HTML UI for entering and viewing data.



- `popup.js` — logic for saving/loading and triggering fill.
The main controller that handles:
Saving and loading data.
Adding/removing Q&A rows.
Running the autofill directly from popup.




- `background.js` — listens for Alt+2 and injects code.
This is the service worker that listens for your keyboard shortcut (Alt+2).

Flow:
When Chrome starts, it checks if the shortcut exists.
When you press Alt+2:
    It gets your saved info (chrome.storage.local.get()).
    It injects three scripts into the current page, same as the popup:
    pageFillFn_TEXT_ONLY_DEFAULTS() → fills standard fields.
    pageFillFn_TEXT_QA_ONLY() → fills text Q&A answers.
    pageFillFn_CHOICES_ONLY() → selects dropdown/checkbox answers.
Shows a quick green “✓” toast with result summary.
The background file is your hotkey bridge — same logic as the popup but triggered automatically.


- `content.js` — DOM helpers used on the page.
Older/basic filler (still works as fallback).
It listens for messages like "FILL_FORM" or "PASTE_DATE" and types into matching inputs using label/placeholder/name text.
Used mostly for simple job forms or when the background-injected script can’t access the page.