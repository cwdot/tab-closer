# Tab Closer

A Firefox extension for closing tabs in bulk — by domain, title, age, or duplicates — with a preview before anything is closed.

## Features

- **Domain filter** — substring or regex match against the hostname. Includes a "top domains" list of any domain with 2+ open tabs (click to fill).
- **Title filter** — substring or regex match against tab titles.
- **Age filter** — close tabs not accessed in the last N hours/days (uses `tab.lastAccessed`).
- **Duplicates** — group by exact URL, URL ignoring query/hash, or title. Keeps the most recently used tab in each group.
- **Preview before closing** — every match is listed with favicon, title, and URL. Uncheck any tab to spare it.
- **Saved presets** — save a configured filter under a name; load or delete from the dropdown.
- **Right-click menus**:
  - On the toolbar icon: jump to a specific filter mode.
  - On any tab: pre-populate a filter from that tab (its domain, title, age, or duplicates of it).

## Install

Download the signed `.xpi` from one of:

- [AMO versions page](https://addons.mozilla.org/en-US/developers/addon/42c7ae142e914e17b34f/versions) (also see the [add-on homepage](https://addons.mozilla.org/en-US/developers/addon/42c7ae142e914e17b34f))
- [GitHub Releases](https://github.com/cwdot/tab-closer/releases)

Then drag it into a Firefox window, or open `about:addons` → gear → **Install Add-on From File…**.

If you don't see the icon in the toolbar after install, click the **puzzle piece** in the toolbar, find Tab Closer, and choose **Pin to Toolbar**.

## Development

### Load as a temporary add-on

For local development, load the extension unsigned via `about:debugging`:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.
3. The extension is removed when Firefox restarts.

### Prerequisites

- Firefox (any modern version)
- `make`, `zip`, and either Node.js or Python 3 (for parsing `manifest.json`)

### Dev loop

The fastest workflow is to load the unpacked extension once, then reload after edits.

1. **First load**: in `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select `manifest.json`.
2. **After editing popup files** (`popup.html`, `popup.css`, `popup.js`): just close and reopen the popup — Firefox re-reads it on each open.
3. **After editing `background.js` or `manifest.json`**: click **Reload** next to Tab Closer in `about:debugging`. Background scripts and the manifest are only re-parsed on reload.
4. **Inspecting**: click **Inspect** next to Tab Closer to open DevTools for the background script. To debug the popup itself, right-click inside the open popup → **Inspect**.

### Linting

```sh
make lint
```

Validates `manifest.json`.

### File layout

```
manifest.json           extension manifest (MV2)
popup.html / .css       toolbar popup UI
popup.js                filter logic, preview, presets, top-domains list
background.js           toolbar + tab context menus, popup pre-fill via storage
icons/icon.svg          toolbar icon
scripts/package.sh      build script
Makefile                build / lint / clean targets
.github/workflows/      CI: builds and releases on tag push
```

### How it works (architecture notes)

- **Filtering** lives entirely in `popup.js`. Each tab in the popup UI maps to one filter mode; switching tabs swaps the visible panel and re-runs the query.
- **Preview** uses `browser.tabs.query({ pinned: false })` and applies the active filter. Pinned tabs are always excluded.
- **Pre-fill from context menus** uses `browser.storage.local`. The background script writes a `pendingFilter` entry, then opens the popup. The popup checks for it on load and clears it after applying.
- **Presets** are stored in `browser.storage.local` under the `presets` key — an array of `{ name, filter }`.

### Build

```sh
make build      # → dist/tab-closer-<version>.xpi
make clean
make version
```

The build script (`scripts/package.sh`) zips an explicit whitelist of files with `manifest.json` at the archive root (Firefox requires this).

## Release process

1. Bump `"version"` in `manifest.json` (must be a new version — Mozilla rejects duplicates).
2. Commit and push.
3. Tag and push the tag:
   ```sh
   git tag v0.3.0
   git push origin v0.3.0
   ```
4. The GitHub Actions workflow at `.github/workflows/release.yml` builds the XPI and attaches it to a new GitHub release. The tag must match the manifest version (`v0.3.0` ↔ `"version": "0.3.0"`) or the workflow fails.
5. To distribute on standard Firefox, upload the XPI to [AMO](https://addons.mozilla.org/developers/) → "On your own" for self-distribution signing, then attach the **signed** XPI to the release (or replace the unsigned one).

## License

MIT
