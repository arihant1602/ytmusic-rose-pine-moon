// Background music visualizer. Runs in the page's own world (manifest "world": "MAIN")
// so Web Audio can tap YouTube Music's <video>. It cannot use extension APIs; the
// isolated content script passes settings through attributes on <html>:
//   data-rpm-accent  theme is on (value picks the lead colour)
//   data-rpm-viz     visualizer is on
//   --rpm-blur       blur radius, read for canvas resolution only (CSS does the blur)
//
// The picture is built to read clearly even when heavily blurred:
//   • a spectrum "skyline" rising from the bottom edge, mirrored faintly from the top
//   • a central bloom that swells with the bass and flashes on every detected beat
//   • anchored side glows that breathe with the mids and highs
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

  const BANDS = 56;
  const FPS = 50;
  const MIN_HZ = 35;
  const MAX_HZ = 12000;

  let wrap, canvas, g;
  let actx, analyser, freq;
  const tapped = new WeakSet();
  let raf = 0;
  let last = 0;
  const t0 = performance.now();

  // Per-band display values and their slow running averages.
  const spec = new Float32Array(BANDS);
  const specAvg = new Float32Array(BANDS).fill(0.05);
  // Bass / mid / high: fast envelope, slow average, and the punchy level we draw.
  const fast = [0, 0, 0];
  const slow = [0.1, 0.1, 0.1];
  const level = [0, 0, 0];
  let beat = 0;
  let lastBeat = 0;
  let loud = 0.2; // long-term loudness, for volume-independent scaling

  const isOn = () => root.hasAttribute("data-rpm-accent") && root.hasAttribute("data-rpm-viz");
  const accent = () => PALETTE[root.dataset.rpmAccent] || PALETTE.iris;
  const rgba = ([r, g, b], a) => `rgb(${r} ${g} ${b} / ${a})`;
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.55;
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

  function analyse(now) {
    const playing = analyser && [...document.querySelectorAll("video")].some((v) => !v.paused);
    if (!playing) {
      for (let i = 0; i < BANDS; i++) spec[i] *= 0.9;
      for (let i = 0; i < 3; i++) { fast[i] *= 0.9; level[i] *= 0.9; }
      beat *= 0.9;
      return;
    }

    analyser.getByteFrequencyData(freq);
    const binHz = actx.sampleRate / analyser.fftSize;
    const avg = (lo, hi) => {
      const a = Math.max(1, Math.floor(lo / binHz));
      const b = Math.max(a, Math.min(freq.length - 1, Math.ceil(hi / binHz)));
      let s = 0;
      for (let i = a; i <= b; i++) s += freq[i];
      return s / ((b - a + 1) * 255);
    };

    // Overall loudness, slowly tracked, so quiet songs and low volume still move.
    const total = avg(MIN_HZ, MAX_HZ);
    loud += (Math.max(total, 0.04) - loud) * 0.01;
    const gain = 0.32 / loud;

    // Spectrum: log-spaced bands, gently tilted so treble isn't dwarfed by bass.
    for (let i = 0; i < BANDS; i++) {
      const lo = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, i / BANDS);
      const hi = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, (i + 1) / BANDS);
      const tilt = 0.8 + 0.6 * (i / BANDS);
      const v = clamp01(avg(lo, hi) * gain * tilt);
      specAvg[i] += (v - specAvg[i]) * 0.03;
      // Emphasise movement over the running average so the skyline visibly dances.
      const shaped = clamp01(v * 0.55 + Math.max(0, v - specAvg[i]) * 1.6);
      spec[i] += (shaped - spec[i]) * (shaped > spec[i] ? 0.7 : 0.18);
    }

    const raw = [avg(35, 150), avg(150, 2000), avg(2000, 9000)];
    for (let i = 0; i < 3; i++) {
      const v = raw[i] * gain;
      fast[i] += (v - fast[i]) * (v > fast[i] ? 0.6 : 0.2);
      slow[i] += (v - slow[i]) * 0.025;
      // Transient above the running average, plus a little of the steady level.
      const punch = Math.max(0, fast[i] - slow[i]) / Math.max(slow[i], 0.05);
      const target = clamp01(punch * 0.9 + fast[i] * 0.35);
      level[i] += (target - level[i]) * (target > level[i] ? 0.6 : 0.12);
    }

    // Beat: bass jumps clearly above its average, at most ~5 per second.
    if (fast[0] > slow[0] * 1.3 && fast[0] > 0.12 && now - lastBeat > 200) {
      beat = 1;
      lastBeat = now;
    } else {
      beat *= 0.88;
    }
  }

  // ───────────── Drawing ─────────────

  function resize() {
    const blur = parseFloat(getComputedStyle(root).getPropertyValue("--rpm-blur")) || 0;
    // Heavy blur hides detail, so render fewer pixels.
    const scale = blur >= 24 ? 0.4 : blur >= 8 ? 0.6 : Math.min(devicePixelRatio, 1.5);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * scale));
    const h = Math.max(1, Math.round(r.height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function glow(x, y, rad, colour, alpha) {
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, rgba(colour, alpha));
    grad.addColorStop(0.5, rgba(colour, alpha * 0.45));
    grad.addColorStop(1, rgba(colour, 0));
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Smooth closed shape through the band heights, anchored to the top or bottom edge.
  function skyline(w, h, maxH, fromTop, alpha) {
    const lead = accent();
    const n = BANDS;
    const step = w / (n - 1);
    const y = (i) => {
      // Light neighbour smoothing keeps the outline organic.
      const v = (spec[Math.max(0, i - 1)] + spec[i] * 2 + spec[Math.min(n - 1, i + 1)]) / 4;
      const hh = Math.max(h * 0.01, v * maxH);
      return fromTop ? hh : h - hh;
    };
    const edge = fromTop ? 0 : h;

    g.beginPath();
    g.moveTo(0, edge);
    g.lineTo(0, y(0));
    for (let i = 0; i < n - 1; i++) {
      const x0 = i * step;
      const x1 = (i + 1) * step;
      g.quadraticCurveTo(x0, y(i), (x0 + x1) / 2, (y(i) + y(i + 1)) / 2);
    }
    g.lineTo(w, y(n - 1));
    g.lineTo(w, edge);
    g.closePath();

    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, rgba(PALETTE.pine, alpha));
    grad.addColorStop(0.35, rgba(lead, alpha));
    grad.addColorStop(0.7, rgba(PALETTE.rose, alpha));
    grad.addColorStop(1, rgba(PALETTE.love, alpha * 0.9));
    g.fillStyle = grad;
    g.fill();
  }

  function draw(now) {
    const { width: w, height: h } = canvas;
    const t = (now - t0) / 1000;
    const m = Math.min(w, h);
    const still = reducedMotion.matches;
    const [bass, mid, high] = still ? [0.15, 0.15, 0.15] : level;
    const b = still ? 0 : beat;
    const lead = accent();

    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";

    // Central bloom: swells with the bass, flashes on the beat.
    const cx = w * 0.5 + Math.sin(t * 0.13) * w * 0.04;
    const cy = h * 0.46 + Math.cos(t * 0.11) * h * 0.04;
    glow(cx, cy, m * (0.42 + bass * 0.32 + b * 0.18), mix(lead, PALETTE.iris, 0.3), 0.22 + bass * 0.3 + b * 0.35);

    // Anchored side glows, slowly breathing in place.
    glow(w * 0.12, h * 0.72 + Math.sin(t * 0.2) * h * 0.04, m * (0.38 + mid * 0.3), PALETTE.rose, 0.16 + mid * 0.38);
    glow(w * 0.88, h * 0.28 + Math.cos(t * 0.17) * h * 0.04, m * (0.34 + high * 0.3), PALETTE.foam, 0.12 + high * 0.38);
    glow(w * 0.8, h * 0.85, m * (0.3 + bass * 0.2), PALETTE.pine, 0.14 + bass * 0.25);

    // Spectrum skyline from the bottom, faint mirror from the top.
    skyline(w, h, h * 0.55, false, 0.7 + b * 0.25);
    skyline(w, h, h * 0.24, true, 0.24 + b * 0.14);

    // A whisper of light across everything on each beat.
    if (b > 0.02) {
      g.fillStyle = rgba(lead, b * 0.06);
      g.fillRect(0, 0, w, h);
    }
  }

  function frame(now) {
    raf = 0;
    if (!isOn() || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    if (!wrap.isConnected) {
      // The app re-rendered <body>; put the layer back.
      mount();
      resize();
    }
    analyse(now);
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
