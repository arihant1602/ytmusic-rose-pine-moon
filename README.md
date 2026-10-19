# YouTube Music — Rosé Pine Moon

A Firefox extension that reskins [YouTube Music](https://music.youtube.com) with the
[Rosé Pine Moon](https://rosepinetheme.com/palette) palette and a calmer, more minimal
layout, with a blurred music visualizer behind the whole page.

| Stock | Rosé Pine Moon |
| --- | --- |
| ![Stock YouTube Music](screenshots/stock.png) | ![Themed YouTube Music](screenshots/home.png) |

![Explore page](screenshots/explore.png)

## Features

- **Background visualizer.** Soft orbs and a spectrum in Rosé Pine colours react to
  whatever is playing, under an adjustable blur (0–120 px). It pauses while the tab is
  hidden and shows a still frame if you prefer reduced motion.
- **Cleaner layout.** Bundled Inter typeface, one consistent type scale, 32 px pill
  buttons and chips, quieter section headers, tidier track rows with tabular durations,
  glass panels instead of solid black boxes.
- **Clear hierarchy.** The accent colour is reserved for primary actions (play,
  subscribe, the current track); everything else stays neutral.
- **Six accents** from the toolbar popup: Iris, Rose, Foam, Pine, Gold, Love.
- **Toggles** for the visualizer, frosted glass and rounded artwork.
- Applied at `document_start`, so the stock theme doesn't flash on load.
- No tracking, no network requests, one permission (`storage`).

<img src="screenshots/popup.png" alt="Settings popup" width="300">

## Install

Requires Firefox 142 or newer.

### Firefox Add-ons (coming soon)

The extension is in review on [addons.mozilla.org](https://addons.mozilla.org). Once it's
approved, installing is one click and updates are automatic. This section will link to
the listing.

### From GitHub (try it now)

1. Download this repo: **Code → Download ZIP**, then unzip it. Or clone it:

   ```sh
   git clone https://github.com/arihant1602/ytmusic-rose-pine-moon.git
   ```

2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` in the downloaded folder.
4. Open [music.youtube.com](https://music.youtube.com). Click the extension's toolbar icon
   (pin it from the puzzle-piece menu) to change the accent, visualizer and blur.

Firefox removes temporary add-ons when it restarts, so repeat steps 2–3 after a restart,
or use the store version once it's live.

> The visualizer starts after your first click or key press on the page. Browsers block
> audio processing until you interact with the page.

## Development

The project uses Mozilla's [`web-ext`](https://github.com/mozilla/web-ext) tool and needs
Node.js 18+.

```sh
npm install
npm start        # launches a clean Firefox profile with the extension loaded and live-reloads on save
npm run lint     # validates the manifest and code against addons.mozilla.org rules
npm run build    # packages the extension into web-ext-artifacts/
```

### Signing your own build

Release builds of Firefox only permanently install add-ons signed by Mozilla. Signing is
free:

1. Sign in at [addons.mozilla.org](https://addons.mozilla.org/developers/) and create API
   credentials under **Tools → Manage API Keys**.
2. Run:

   ```sh
   WEB_EXT_API_KEY=user:xxxx WEB_EXT_API_SECRET=xxxx npm run sign
   ```

   This signs the build as an **unlisted** add-on (installable, not shown in the store)
   and writes the signed `.xpi` to `web-ext-artifacts/`.
3. Open that `.xpi` in Firefox and click **Add**.

`npm run sign:listed` submits to the public store using the listing text in
`amo-metadata.json`. Each upload needs a higher `version` in `manifest.json`.

## How it works

| File | Role |
| --- | --- |
| `src/theme.css` | Injected by the manifest. Remaps YouTube Music's own design tokens (`--ytmusic-*`, `--yt-spec-*`, Polymer `--paper-*`) and restyles components. Every rule is scoped to `html[data-rpm-accent]`, so the theme switches off instantly. |
| `src/content.js` | Reads your settings from `storage` and mirrors them onto `<html>` as `data-rpm-*` attributes and the `--rpm-blur` variable. |
| `src/visualizer.js` | Runs in the page's own world so Web Audio can read the `<video>` element. Draws to a low-resolution canvas fixed behind the app; CSS applies the blur. It only connects to the audio once the audio context is running, so playback is never silenced. |
| `src/popup/` | The settings popup. |

YouTube Music changes its markup from time to time. If something looks off, open an
issue with a screenshot and the page it's on.

## Credits

Colours from [Rosé Pine](https://rosepinetheme.com). Typeface:
[Inter](https://rsms.me/inter/) (SIL Open Font License, see `fonts/OFL.txt`).
Not affiliated with YouTube or Google.

## License

[MIT](LICENSE)
