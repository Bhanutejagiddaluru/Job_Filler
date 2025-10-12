// Listens for Alt+2 (paste-date) and tells the active tab to paste the date.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "paste-date") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Just ping the content script. It will read dateFormat from storage and paste.
  chrome.tabs.sendMessage(tab.id, { type: "PASTE_DATE" }).catch(() => {});
});
