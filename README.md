# YouTube Music — Rosé Pine Moon

A Firefox extension that reskins [YouTube Music](https://music.youtube.com) with the
[Rosé Pine Moon](https://rosepinetheme.com/palette) palette: muted purples instead of
flat black, soft rounded artwork, a frosted-glass player bar and one accent colour
used throughout.

| Stock | Rosé Pine Moon |
| --- | --- |
| ![Stock YouTube Music](screenshots/stock.png) | ![Themed YouTube Music](screenshots/home.png) |

## Features

- Full Rosé Pine Moon palette, applied by remapping YouTube Music's own design tokens
  (`--ytmusic-*`, `--yt-spec-*`, Polymer `--paper-*`) plus targeted component styles
- Pick any of six accents from the toolbar popup: Iris, Rose, Foam, Pine, Gold, Love
- Frosted-glass top bar and player bar (toggle)
- Rounded artwork with shadows and hover lift (toggle)
- Accent play/pause disc, gradient progress bar, highlighted current track in lists and queue
- Themed menus, dialogs, tooltips, chips, tabs, search box and scrollbars
- Applied at `document_start`, so the stock theme doesn't flash on load
- Respects `prefers-reduced-motion`
- No tracking, no network requests, one permission (`storage`)

## Install

### From source (temporary)

1. Clone this repo.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…** and select `manifest.json`.

Temporary add-ons are removed when Firefox restarts.

### Development

The project uses Mozilla's [`web-ext`](https://github.com/mozilla/web-ext) tool.

```sh
npm install
npm start        # launches a clean Firefox profile with the extension loaded and live-reloads on save
npm run lint     # validates the manifest and code against addons.mozilla.org rules
npm run build    # packages the extension into web-ext-artifacts/
```

Requires Firefox 142 or newer.

## How it works

`src/content.js` runs on `music.youtube.com` at `document_start`. It adds a `<link>` to
`src/theme.css` and sets `data-rpm-*` attributes on `<html>` from your saved settings.
Every rule in the stylesheet is scoped to `html[data-rpm-accent]`, so turning the theme
off from the popup removes it instantly without a reload.

YouTube Music changes its markup from time to time. If something looks off, open an
issue with a screenshot and the page it's on.

## Credits

Colours from [Rosé Pine](https://rosepinetheme.com). Not affiliated with YouTube or Google.

## License

[MIT](LICENSE)
