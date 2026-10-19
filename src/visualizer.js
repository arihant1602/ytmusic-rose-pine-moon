// Background music visualizer. Runs in the page's own world (manifest "world": "MAIN")
// so Web Audio can tap YouTube Music's <video>. It cannot use extension APIs; the
// isolated content script passes settings through attributes on <html>:
//   data-rpm-accent  theme is on (value picks the lead colour)
//   data-rpm-viz     visualizer is on
//   --rpm-blur       blur radius, read for canvas resolution only (CSS does the blur)
(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const PALETTE = {
    iris: [196, 167, 231],
    rose: [234, 154, 151],
    foam: [156, 207, 216],
    pine: [62, 143, 176],
    gold: [246, 193, 119],
    love: [235, 111, 146],
  };

  // Orbs: [colour, band (0 bass, 1 mids, 2 highs), size, x/y drift speeds, phase]
  const ORBS = [
    ["accent", 0, 0.42, 0.07, 0.05, 0.0],
    ["pine", 0, 0.36, 0.05, 0.08, 1.7],
    ["rose", 1, 0.30, 0.09, 0.06, 3.1],
    ["foam", 1, 0.26, 0.06, 0.1, 4.4],
    ["love", 2, 0.22, 0.11, 0.07, 5.2],
    ["gold", 2, 0.16, 0.08, 0.12, 2.3],
  ];

  const BARS = 72;
  const FPS = 40;

  let wrap, canvas, g;
  let actx, analyser, freq;
  const tapped = new WeakSet();
  let raf = 0;
  let last = 0;
  let t0 = performance.now();
  const bands = [0, 0, 0];
  const peaks = [1e-3, 1e-3, 1e-3];
  const bars = new Float32Array(BARS);
  let barPeak = 1e-3;

  const isOn = () => root.hasAttribute("data-rpm-accent") && root.hasAttribute("data-rpm-viz");

  function colour(name) {
    if (name === "accent") return PALETTE[root.dataset.rpmAccent] || PALETTE.iris;
    return PALETTE[name];
  }

  // ───────────── Audio ─────────────

  async function tapAudio() {
    if (!isOn()) return;
    const video = document.querySelector("video");
    if (!video || tapped.has(video)) return;

    actx ||= new AudioContext();
    if (actx.state !== "running") {
      try { await actx.resume(); } catch {}
    }
    // Routing a <video> into a suspended context would silence it, so only tap once
    // the context is actually running (i.e. after a user gesture).
    if (actx.state !== "running" || tapped.has(video)) return;

    tapped.add(video);
    try {
      const source = actx.createMediaElementSource(video);
      analyser = actx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      freq = new Uint8Array(analyser.frequencyBinCount);
      source.connect(actx.destination);
      source.connect(analyser);
    } catch (err) {
      // Already captured by another script/extension: fall back to idle animation.
      console.debug("[rpm] visualizer could not tap audio:", err);
    }
  }

  for (const type of ["play", "playing"]) {
    document.addEventListener(type, tapAudio, true); // media events don't bubble
  }
  for (const type of ["pointerdown", "keydown"]) {
    addEventListener(type, tapAudio, { capture: true, passive: true });
  }

  // ───────────── Analysis ─────────────

  function analyse() {
    const playing = analyser && [...document.querySelectorAll("video")].some((v) => !v.paused);
    if (!playing) {
      for (let i = 0; i < 3; i++) bands[i] *= 0.94;
      for (let i = 0; i < BARS; i++) bars[i] *= 0.9;
      return;
    }

    analyser.getByteFrequencyData(freq);
    const nyquist = actx.sampleRate / 2;
    const bin = (hz) => Math.min(freq.length - 1, Math.round((hz / nyquist) * freq.length));
    const avg = (a, b) => {
      let s = 0;
      for (let i = a; i <= b; i++) s += freq[i];
      return s / ((b - a + 1) * 255);
    };

    const raw = [avg(bin(30), bin(160)), avg(bin(160), bin(2000)), avg(bin(2000), bin(10000))];
    for (let i = 0; i < 3; i++) {
      // Adaptive normalisation keeps motion lively at any volume.
      peaks[i] = Math.max(peaks[i] * 0.996, raw[i], 0.05);
      const v = raw[i] / peaks[i];
      bands[i] += (v - bands[i]) * (v > bands[i] ? 0.5 : 0.12);
    }

    // Log-spaced spectrum bars from 40 Hz to 14 kHz.
    let frameMax = 0;
    for (let i = 0; i < BARS; i++) {
      const lo = 40 * Math.pow(14000 / 40, i / BARS);
      const hi = 40 * Math.pow(14000 / 40, (i + 1) / BARS);
      const a = bin(lo);
      const v = avg(a, Math.max(a, bin(hi)));
      frameMax = Math.max(frameMax, v);
      bars[i] += (v - bars[i]) * (v > bars[i] ? 0.55 : 0.15);
    }
    barPeak = Math.max(barPeak * 0.996, frameMax, 0.08);
  }

  // ───────────── Drawing ─────────────

  function resize() {
    const blur = parseFloat(getComputedStyle(root).getPropertyValue("--rpm-blur")) || 0;
    // Heavy blur hides detail, so render fewer pixels.
    const scale = blur >= 24 ? 0.35 : blur >= 8 ? 0.6 : Math.min(devicePixelRatio, 1.5);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * scale));
    const h = Math.max(1, Math.round(r.height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw(now) {
    const { width: w, height: h } = canvas;
    const t = (now - t0) / 1000;
    const still = reducedMotion.matches;
    const m = Math.min(w, h);

    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";

    for (const [name, band, size, sx, sy, phase] of ORBS) {
      const [r, gr, b] = colour(name);
      const e = still ? 0 : bands[band];
      const x = w * (0.5 + 0.38 * Math.sin(t * sx + phase));
      const y = h * (0.45 + 0.32 * Math.cos(t * sy + phase * 1.3));
      const rad = m * size * (1.1 + e * 0.6);
      const alpha = 0.32 + e * 0.38;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgb(${r} ${gr} ${b} / ${alpha})`);
      grad.addColorStop(0.55, `rgb(${r} ${gr} ${b} / ${alpha * 0.4})`);
      grad.addColorStop(1, `rgb(${r} ${gr} ${b} / 0)`);
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    // Mirrored spectrum rising from the bottom edge.
    const gap = w / BARS;
    const bw = Math.max(1, gap * 0.62);
    const maxH = h * 0.42;
    const lead = colour("accent");
    const pine = PALETTE.pine;
    for (let i = 0; i < BARS; i++) {
      const k = i / (BARS - 1);
      const v = Math.pow(Math.min(1, bars[i] / barPeak), 1.6);
      const bh = Math.max(h * 0.004, v * maxH);
      const x = i * gap + (gap - bw) / 2;
      const c = pine.map((p, j) => Math.round(p + (lead[j] - p) * k));
      const grad = g.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, `rgb(${c[0]} ${c[1]} ${c[2]} / 0.75)`);
      grad.addColorStop(1, `rgb(${c[0]} ${c[1]} ${c[2]} / 0)`);
      g.fillStyle = grad;
      g.fillRect(x, h - bh, bw, bh);
    }
  }

  function frame(now) {
    raf = 0;
    if (!isOn() || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    if (!wrap.isConnected) {
      // The app re-rendered <body>; put the layer back.
      mount();
      resize();
    }
    last = now;
    analyse();
    draw(now);
  }

  function start() {
    if (raf || !isOn() || document.hidden) return;
    resize();
    if (reducedMotion.matches) {
      // One calm, static frame instead of a loop.
      draw(t0);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // ───────────── Mounting ─────────────

  function mount() {
    if (wrap?.isConnected) return true;
    if (!document.body) return false;
    wrap = document.createElement("div");
    wrap.id = "rpm-viz";
    wrap.setAttribute("aria-hidden", "true");
    canvas = document.createElement("canvas");
    wrap.append(canvas);
    document.body.prepend(wrap);
    g = canvas.getContext("2d", { alpha: true });
    return true;
  }

  function sync() {
    if (isOn()) {
      if (!mount()) return;
      resize();
      tapAudio();
      start();
    } else {
      stop();
      g?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: ["data-rpm-accent", "data-rpm-viz", "style"],
  });

  addEventListener("resize", () => canvas && resize(), { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reducedMotion.addEventListener("change", () => { stop(); start(); });

  if (document.body) sync();
  else document.addEventListener("DOMContentLoaded", sync, { once: true });
})();
