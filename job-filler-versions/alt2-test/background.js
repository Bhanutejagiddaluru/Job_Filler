// Alt+2 Test Extension
// Shows a visible banner and badge whenever Alt+2 is pressed

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "alt2-test") return;

  try {
    // Badge feedback on toolbar
    await chrome.action.setBadgeText({ text: "A2" });
    await chrome.action.setBadgeBackgroundColor({ color: "#16a34a" }); // green
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1500);

    // Show a banner on the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        // Remove any existing banner
        const old = document.getElementById("alt2-banner");
        if (old) old.remove();

        // Create new banner
        const banner = document.createElement("div");
        banner.id = "alt2-banner";
        banner.textContent = "✅ Alt + 2 detected!";
        Object.assign(banner.style, {
          position: "fixed",
          top: "10px",
          right: "10px",
          zIndex: "2147483647",
          background: "#16a34a",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          fontWeight: "500",
          padding: "10px 16px",
          borderRadius: "8px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)"
        });
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 1500);

        console.log("[Alt2 Test] ✅ Alt + 2 detected and banner shown!");
      }
    });
  } catch (err) {
    console.error("[Alt2 Test] Error running command:", err);
  }
});
