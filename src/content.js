"use strict";

// The stylesheet is injected by the manifest and every rule is scoped to
// html[data-rpm-accent], so this script only has to mirror settings onto <html>.
// src/visualizer.js (page world) reads the same attributes.

const DEFAULTS = { enabled: true, accent: "iris", glass: true, artwork: true, viz: true, blur: 48 };
const ACCENTS = ["iris", "rose", "foam", "pine", "gold", "love"];
const root = document.documentElement;

function apply(settings) {
  const s = { ...DEFAULTS, ...settings };

  if (!s.enabled) {
    for (const a of ["data-rpm-accent", "data-rpm-glass", "data-rpm-artwork", "data-rpm-viz"]) {
      root.removeAttribute(a);
    }
    root.style.removeProperty("--rpm-blur");
    return;
  }

  root.dataset.rpmAccent = ACCENTS.includes(s.accent) ? s.accent : DEFAULTS.accent;
  root.toggleAttribute("data-rpm-glass", s.glass);
  root.toggleAttribute("data-rpm-artwork", s.artwork);
  root.toggleAttribute("data-rpm-viz", s.viz);
  const blur = Math.min(120, Math.max(0, Number(s.blur) || 0));
  root.style.setProperty("--rpm-blur", `${blur}px`);
}

// Apply defaults synchronously so the stock theme never flashes.
apply(DEFAULTS);
browser.storage.local.get(DEFAULTS).then(apply);

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") browser.storage.local.get(DEFAULTS).then(apply);
});
