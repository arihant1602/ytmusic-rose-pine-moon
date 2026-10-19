"use strict";

const DEFAULTS = { enabled: true, accent: "iris", glass: true, artwork: true, viz: true, blur: 48 };
const ACCENT_COLORS = {
  iris: "#c4a7e7",
  rose: "#ea9a97",
  foam: "#9ccfd8",
  pine: "#3e8fb0",
  gold: "#f6c177",
  love: "#eb6f92",
};
const TOGGLES = ["enabled", "glass", "artwork", "viz"];

const $ = (sel) => document.querySelector(sel);

function render(s) {
  for (const key of TOGGLES) $(`#${key}`).checked = s[key];
  $(`input[name="accent"][value="${s.accent}"]`).checked = true;
  $("#blur").value = s.blur;
  $("#blur-value").textContent = `${s.blur} px`;
  $("#blur-row").classList.toggle("disabled", !s.viz);
  $("#options").classList.toggle("disabled", !s.enabled);
  document.documentElement.style.setProperty("--accent", ACCENT_COLORS[s.accent]);
}

const save = (patch) => browser.storage.local.set(patch);

browser.storage.local.get(DEFAULTS).then((s) => {
  render(s);

  for (const key of TOGGLES) {
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

  // Live preview while dragging; storage writes are cheap but throttle to one per frame.
  let pending = 0;
  $("#blur").addEventListener("input", (e) => {
    s.blur = Number(e.target.value);
    render(s);
    if (!pending) {
      pending = requestAnimationFrame(() => {
        pending = 0;
        save({ blur: s.blur });
      });
    }
  });
});
