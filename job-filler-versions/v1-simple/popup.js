const els = {
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  summary: document.getElementById("summary"),
  dateFormat: document.getElementById("dateFormat"),
  saveBtn: document.getElementById("saveBtn"),
  fillBtn: document.getElementById("fillBtn"),
  pasteDateBtn: document.getElementById("pasteDateBtn"),
};

function load() {
  chrome.storage.local.get(
    {
      name: "",
      email: "",
      phone: "",
      address: "",
      summary: "",
      dateFormat: "YYYY-MM-DD",
    },
    (res) => {
      els.name.value = res.name;
      els.email.value = res.email;
      els.phone.value = res.phone;
      els.address.value = res.address;
      els.summary.value = res.summary;
      els.dateFormat.value = res.dateFormat;
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
      summary: els.summary.value,
      dateFormat: els.dateFormat.value,
    },
    () => {
      els.saveBtn.textContent = "Saved ✓";
      setTimeout(() => (els.saveBtn.textContent = "Save"), 900);
    }
  );
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  return chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

async function fillOnPage() {
  // ensure latest values from storage
  chrome.storage.local.get(
    ["name", "email", "phone", "address", "summary"],
    async (data) => {
      await sendToActiveTab({ type: "FILL_FORM", payload: data });
      els.fillBtn.textContent = "Filled ✓";
      setTimeout(() => (els.fillBtn.textContent = "Fill Application On This Page"), 1200);
    }
  );
}

async function pasteDateNow() {
  await sendToActiveTab({ type: "PASTE_DATE" });
  els.pasteDateBtn.textContent = "Pasted ✓";
  setTimeout(() => (els.pasteDateBtn.textContent = "Paste Today’s Date"), 900);
}

els.saveBtn.addEventListener("click", save);
els.fillBtn.addEventListener("click", fillOnPage);
els.pasteDateBtn.addEventListener("click", pasteDateNow);
document.addEventListener("DOMContentLoaded", load);
