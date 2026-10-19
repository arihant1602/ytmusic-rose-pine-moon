"use strict";

const DEFAULTS = { enabled: true, accent: "iris", glass: true, artwork: true };
const ACCENTS = ["iris", "rose", "foam", "pine", "gold", "love"];
const LINK_ID = "rpm-theme";
const root = document.documentElement;

let current = DEFAULTS;

function apply(settings) {
  const s = (current = { ...DEFAULTS, ...settings });
  let link = document.getElementById(LINK_ID);

  if (!s.enabled) {
    link?.remove();
    root.removeAttribute("data-rpm-accent");
    return;
  }

  if (!link) {
    link = document.createElement("link");
    link.id = LINK_ID;
    link.rel = "stylesheet";
    link.href = browser.runtime.getURL("src/theme.css");
    // <head> may not exist yet at document_start; <html> always does.
    (document.head || root).appendChild(link);
  }

  root.dataset.rpmAccent = ACCENTS.includes(s.accent) ? s.accent : DEFAULTS.accent;
  root.toggleAttribute("data-rpm-glass", s.glass);
  root.toggleAttribute("data-rpm-artwork", s.artwork);
}

// Apply defaults synchronously so the page never flashes the stock theme.
apply(DEFAULTS);
browser.storage.local.get(DEFAULTS).then(apply);

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  browser.storage.local.get(DEFAULTS).then(apply);
});

// The sheet may have been parked on <html> before <head> existed, and the page can
// swap <head> out later. Keep the link inside the live <head>.
new MutationObserver(() => {
  if (!current.enabled || !document.head) return;
  const link = document.getElementById(LINK_ID);
  if (!link) apply(current);
  else if (link.parentNode !== document.head) document.head.appendChild(link);
}).observe(root, { childList: true });
