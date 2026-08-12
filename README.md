# Are.na Connections

Are.na Connections is an unofficial browser extension that shows where the page
you are viewing appears on Are.na. Click the extension button to find exact URL
matches, see their originating channels and connection totals, and open any
matching block on Are.na.

Lookups happen only when you click the extension button. The extension does not
follow your browsing in the background.

## Requirements

- Chrome 116 or later, Firefox 115 or later, or Safari 18 or later (the
  documented Develop → Add Temporary Extension flow; Safari 16.4–17 works via
  the Xcode route in [docs/safari.md](docs/safari.md))
- An Are.na Premium account (the v3 search endpoint requires Premium)

Building from source additionally needs Node.js `20.19+` or `22.12+` and npm,
but installing from a release does not.

## Install

Are.na Connections isn't in any browser's extension store yet, so you install
it by hand from a **[release](../../releases/latest)** — no build tools, no
Node, no command line for Chrome and Firefox.

Find your browser below. How much work this is genuinely differs per browser,
and that's the browsers' doing, not the extension's:

| Your browser | What you download | Effort | Survives a restart? |
| --- | --- | --- | --- |
| **Chrome** | `arena-connections-chrome-<version>.zip` | Unzip, load folder | Yes |
| **Firefox** | the `.xpi` file | Install the file | Yes |
| **Safari (macOS)** | source | Needs Xcode | No — re-enable each launch |
| **Safari (iOS)** | source | Needs Xcode + Simulator | Simulator only |

Not sure which you have? Chrome and Firefox are the easy ones — if you're on
one of those, you're two minutes away.

### Chrome

1. Download `arena-connections-chrome-<version>.zip` from the
   [latest release](../../releases/latest).
2. Unzip it somewhere you'll keep it — Chrome loads the extension from that
   folder, so don't delete it afterwards.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the unzipped folder.
6. Optionally pin **Are.na Connections** from the Extensions menu.

To update: download the new zip, replace the folder's contents, then click
**Reload** on the extension's card.

Other Chromium browsers (Edge, Brave, Arc) use the same zip and the same
`Load unpacked` flow, but they aren't tested — Chrome is what's verified.

### Firefox

Download the `.xpi` file from the [latest release](../../releases/latest), then
open `about:addons` → the gear icon → **Install Add-on From File…** → select
it.

That file is signed by Mozilla, which is what lets it stay installed. Release
Firefox refuses to install unsigned extensions permanently, and
`xpinstall.signatures.required` only works on Developer Edition, Nightly, and
ESR.

If a release has no `.xpi` attached, signing wasn't configured or Mozilla's
validation failed for that version; you can still load a build temporarily via
`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**, which
lasts until you quit Firefox. Signing it yourself takes a free Mozilla account
— see [docs/firefox.md](docs/firefox.md).

Note the Add-ons manager's "Install Add-on From File…" only accepts a signed
`.xpi`; it greys out `manifest.json`.

### Safari (macOS)

Safari has no "load unpacked" equivalent that works without **Xcode**, so this
one needs the source and a build. There's no download that avoids it.

```sh
npm ci
npm run build:safari
```

1. Safari → Settings → **Advanced** → tick **Show features for web developers**.
2. **Develop** menu → **Allow Unsigned Extensions**.
3. **Develop** → **Add Temporary Extension…** → select the `dist/safari`
   *folder* (not `manifest.json` inside it).
4. Safari → Settings → **Extensions** → tick **Are.na Connections**, and grant
   it access to `api.are.na`.

**Allow Unsigned Extensions resets every time Safari quits**, and an unsigned
extension is hidden from the Extensions list entirely rather than shown as
disabled — so if it vanishes, that's why. Re-do steps 2–3.

The panel opens as a popup rather than a sidebar on Safari; that's expected.
There is also an Xcode project at `apple/` for building the container app;
see [docs/safari.md](docs/safari.md).

### Safari (iOS)

Simulator only unless you have an Apple Developer Program membership — iOS
extensions ship only inside an App Store app. Build and run the
**Are.na Connections (iOS)** scheme from `apple/`, then enable the extension in
Settings → Apps → Safari → Extensions. Steps and current limitations are in
[docs/ios-findings.md](docs/ios-findings.md). On iOS, OAuth sign-in finishes
when you **reopen the extension** after approving on Are.na — the popup
completes the exchange on open. Token paste-in also works as a fallback.

## Connect your Are.na account

1. Click **Are.na Connections** on a normal web page. The sign-in card opens in
   the side panel.
2. Leave **Remember device** unchecked to keep your connection for the
   current browser session only. Check it to stay signed in between sessions.
3. Click **Sign in with Are.na ✶✶**.
4. Approve the read-only connection on Are.na.

On iOS, after approving on Are.na, reopen the extension — sign-in completes
on open and the approval tab closes itself.

The extension can read the Are.na data available to your account, but cannot
create, edit, or delete anything. Signing out removes the saved access token
from the extension. You can fully revoke access from Are.na's
[Authorized Apps](https://www.are.na/developers/oauth/authorized) page.

Return to the page you want to check and click the extension button. The Are.na
Connections side panel will open with the matching blocks.

## Build from source

For development, or for Safari, which has no download-and-install path.

```sh
npm ci
npm test
npm run build
```

`npm run build` builds all three targets into `dist/chrome`, `dist/firefox`,
and `dist/safari`. Build one at a time with `npm run build:chrome`,
`build:firefox`, or `build:safari`. Load the resulting `dist/<target>` folder
using your browser's steps above (Chrome: **Load unpacked**; Firefox:
**Load Temporary Add-on…** on `dist/firefox/manifest.json`).

`dist/` is a build artifact and is not committed — that's why installing
without building means downloading a release.

### Cutting a release

`npm run package` rebuilds every target from source and writes the release
zips into `dist/`. Pushing a `v<version>` tag runs
[the release workflow](.github/workflows/release.yml), which does the same and
attaches the results to a GitHub Release:

```sh
# bump `version` in package.json AND public/manifest.base.json first — they
# must agree, and the tag must match both
git tag v0.3.0 && git push origin v0.3.0
```

Two things worth knowing about the artifacts:

- **Chrome gets two zips.** The plain one keeps the manifest `key` and is what
  users load unpacked; `*-webstore.zip` has it stripped for Chrome Web Store
  upload. They are not interchangeable — the `key` pins the extension ID, which
  pins the OAuth redirect URI registered with Are.na, so loading the store zip
  unpacked breaks sign-in. Only the plain zip is attached to releases; see
  [docs/store-readiness.md](docs/store-readiness.md).
- **The signed Firefox `.xpi` needs AMO credentials.** Set the
  `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` repository secrets and the
  workflow signs and attaches it; without them the release still publishes,
  just without an `.xpi`. Mozilla rejects re-signing a version it has already
  signed, so every release needs a fresh version number.
  See [docs/firefox.md](docs/firefox.md).
