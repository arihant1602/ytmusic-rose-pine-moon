"use strict";

const DEFAULTS = { enabled: true, accent: "iris", glass: true, artwork: true };
const ACCENT_COLORS = {
  iris: "#c4a7e7",
  rose: "#ea9a97",
  foam: "#9ccfd8",
  pine: "#3e8fb0",
  gold: "#f6c177",
  love: "#eb6f92",
};

const $ = (sel) => document.querySelector(sel);

function render(s) {
  $("#enabled").checked = s.enabled;
  $("#glass").checked = s.glass;
  $("#artwork").checked = s.artwork;
  $(`input[name="accent"][value="${s.accent}"]`).checked = true;
  $("#options").classList.toggle("disabled", !s.enabled);
  document.documentElement.style.setProperty("--accent", ACCENT_COLORS[s.accent]);
}

const save = (patch) => browser.storage.local.set(patch);

browser.storage.local.get(DEFAULTS).then((s) => {
  render(s);

  for (const key of ["enabled", "glass", "artwork"]) {
    $(`#${key}`).addEventListener("change", (e) => {
      s[key] = e.target.checked;
      render(s);
      save({ [key]: s[key] });
    });
  }

  for (const radio of document.querySelectorAll('input[name="accent"]')) {
    radio.addEventListener("change", (e) => {
      s.accent = e.target.value;
      render(s);
      save({ accent: s.accent });
    });
  }
});
