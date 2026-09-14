# Chrome Web Store readiness checklist

Are.na Connections currently ships as a GitHub Release zip that users load
unpacked (or a local `npm run build:chrome` → `dist/chrome`) and is not yet
published to the Chrome Web Store. This checklist covers what is left before a
first store release.

The code is ready; everything outstanding is dashboard and account work. The
one item with a hard ordering constraint is the OAuth redirect URI below —
it cannot be registered until a draft upload has reserved the Store's
extension ID, and sign-in is broken for every Store user until it is.

**Status, 2026-09-13:** paused with an unpublished draft in the dashboard. The
developer account exists and the package is uploaded, so the extension ID has
been minted. Still to do: the Store listing fields, the Privacy practices tab,
screenshots, and the redirect URI registration. Resume by reading the ID off
the item page URL (`.../devconsole/<publisher-uuid>/<EXTENSION-ID>/edit`).

Note for anyone automating this: the dashboard **cannot** be driven by browser
automation. Chrome blocks all extension scripting on `chrome.google.com/webstore/*`
("The extensions gallery cannot be scripted") so that extensions cannot
manipulate listings or installs. It is not a permission that can be granted,
and `chromewebstore.google.com/devconsole` redirects back to the blocked
origin. The fields have to be filled by hand.

## Manifest `key` and OAuth redirect

`public/manifest.chrome.json` pins a `key` field so the extension keeps a stable ID
across unpacked reloads. The Chrome Web Store **rejects uploaded packages
that contain a `key` field**, so it must be stripped from the zip before
upload. Removing it means the Store assigns a new extension ID, and that ID
changes the OAuth redirect URI the extension uses
(`chrome.identity.getRedirectURL('oauth2')` →
`https://<extension-id>.chromiumapp.org/oauth2`). If that redirect isn't
registered with Are.na before the first store release, sign-in will fail for
everyone who installs from the Store.

- [x] Register as a Chrome Web Store developer (one-time $5 USD fee) at
      https://chrome.google.com/webstore/devconsole — done 2026-09-13,
      declared **non-trader** (free personal project; a trader account would
      have to publish a postal address and phone number on the listing).
- [x] Do a first draft/private upload to the dashboard (with `key` stripped)
      to reserve the permanent Store extension ID — done 2026-09-13. **Not
      published**, and it must stay that way until the redirect URI below is
      registered.
- [ ] Register that Store ID's `https://<id>.chromiumapp.org/oauth2`
      redirect URI with the Are.na OAuth application, alongside the existing
      unpacked-dev redirect. Are.na's Redirect URI field is a single line and
      splits on whitespace, so **append** it separated by a space — do not
      replace what is there. The field's current contents and the failure mode
      if it stops parsing are documented in `docs/firefox.md` ("Registering
      more than one redirect URI on Are.na").
- [ ] Re-verify sign-in in **Chrome (unpacked), Firefox, and Safari** after
      editing that field. A value Are.na parses as one malformed URI breaks
      every target at once, not just the one being added.
- [x] Keep `key` in the repo's `public/manifest.chrome.json` (unpacked
      installs need it for a stable ID) and strip it only in the store zip —
      done: `npm run package` emits two Chrome zips from one build, the plain
      one keeping `key` for load-unpacked installs and
      `*-webstore.zip` stripping it in a staging copy, while
      `dist/chrome/manifest.json` on disk keeps it. The release workflow
      attaches only the plain zip, since a `key`-less unpacked install gets a
      per-machine ID whose redirect URI is unregistered.
- [ ] Confirm sign-in works end-to-end from a Store-installed (or draft
      test) build before announcing the release.

## Privacy policy

- [x] Host the policy at a public URL —
      **https://jsplitlog.github.io/arena-connections/privacy.html**, served
      from `site/privacy.html` by `.github/workflows/pages.yml` on push to
      `main`. The dashboard requires this because the extension uses the
      `identity` permission and sends data derived from the active page's URL
      to `api.are.na`.
- [x] Fill in the contact placeholder in `PRIVACY.md` — now points at the
      repo's GitHub issue tracker.
- [ ] Enter the hosted URL in the dashboard's Privacy tab.

`PRIVACY.md` and `site/privacy.html` carry the same text in two formats and
are maintained by hand. **Edit them together** — a store listing pointing at
a policy that contradicts the repo is the drift this note exists to prevent.

## Data-use disclosures (dashboard "Privacy practices" tab)

- [ ] Declare **website content** (the current page's URL) as data
      collected, used to search Are.na for matching blocks.
- [ ] Declare **authentication information** (the Are.na OAuth token) as
      stored, used for signing in to Are.na.
- [ ] Leave every other category unchecked — no personally identifiable
      information, health, financial, location, personal communications,
      or web-history data is collected.
- [ ] Answer **"No, I am not using remote code"**: all executed code ships
      inside the package. The extension makes `fetch` calls to `api.are.na`
      for data only, and the CSP in `public/manifest.base.json`
      (`default-src 'self'`) forbids loading script from anywhere else.
- [ ] Certify: not sold to third parties; not used for purposes unrelated
      to the extension's single purpose; not used for creditworthiness or
      lending decisions.

## Permission justifications (dashboard "Permissions" section)

Paste-ready text. Each field wants a reviewer-facing explanation of why the
permission is necessary, not a description of what it does.

**`activeTab`**

> Are.na Connections reads the URL of the active tab only in direct response
> to the user clicking the extension's toolbar icon. That URL *is* the search
> query — the extension's entire function is finding Are.na blocks that point
> at the page the user is currently on. `activeTab` is used in preference to a
> broad host permission precisely because it grants access only at the moment
> of that click, and never during ordinary browsing.

**`storage`**

> Stores three things, all locally: the user's Are.na OAuth access token, a
> short-lived cache of lookup results so that revisiting a page does not repeat
> an identical API call, and two anonymous counters (lookups performed and
> matches found) that are never surfaced or transmitted. The token is
> held in `chrome.storage.session` by default, so it is cleared when the
> browser session ends; it is written to `chrome.storage.local` only when the
> user explicitly ticks "Remember device". None of this data leaves the
> user's device.

**`identity`**

> Used for `chrome.identity.launchWebAuthFlow` to run Are.na's OAuth 2.0
> authorization-code sign-in. The extension needs an authenticated Are.na
> account to call the search API, and `launchWebAuthFlow` is how the user
> grants read-only access on are.na without the extension ever seeing their
> password. The scope requested is read-only; the extension cannot create,
> edit, or delete anything in the user's Are.na account.

**`sidePanel`**

> The side panel is the extension's entire user interface. Clicking the
> toolbar icon opens it, and it is where sign-in, the blocks matching the
> current page, and the channel and connection details are displayed. The
> extension has no popup and injects no UI into web pages.

**Host permission `https://api.are.na/*`**

> Every network request the extension itself makes goes to this one origin,
> Are.na's public API: the v3 search endpoint to find blocks matching the
> current page's URL, `/v3/me` to show who is signed in, and `/v3/oauth/token`
> to exchange the authorization code. There are exactly three `fetch` call
> sites in the source and all three target `https://api.are.na`. No other host
> is contacted and no data is sent anywhere else.
>
> (The sign-in flow also shows the user `https://www.are.na/oauth/authorize`,
> but the extension never requests that page itself — `launchWebAuthFlow`
> renders it in a browser-controlled window, which is why no host permission
> for `www.are.na` is needed or requested.)

## Listing content

**Single purpose** (paste-ready):

> Are.na Connections has one purpose: showing the user where the web page they
> are currently viewing appears on Are.na. When the user clicks the toolbar
> icon, the extension searches Are.na for blocks whose source URL matches the
> current page, and displays those blocks, the channels they belong to, and
> their connection counts in the side panel.

**Description** (paste-ready draft — the Premium requirement is in the first
paragraph deliberately, so it is visible before install):

> See where the page you're reading already lives on Are.na.
>
> Click the toolbar button on any page and Are.na Connections searches Are.na
> for blocks pointing at that exact URL, then shows you what it found: the
> matching blocks, the channels they were connected to, and how many
> connections each one has. Click through to open any block on Are.na.
>
> Requires an Are.na Premium account. The extension uses Are.na's v3 search
> endpoint, which is only available to Premium subscribers.
>
> Lookups happen only when you click the button. The extension does not follow
> your browsing in the background, and the only server it ever contacts is
> api.are.na — no analytics, no telemetry, no third-party trackers.
>
> Sign in with your Are.na account using Are.na's own OAuth flow. Access is
> read-only: the extension can read what your account can see, but cannot
> create, edit, or delete anything. You can revoke it any time from Are.na's
> Authorized Apps page.
>
> Are.na Connections is an unofficial, third-party extension and is not
> operated by or affiliated with Are.na.

- [ ] Add **reviewer test credentials** — an Are.na Premium account — in the
      submission's review notes, plus a note that the extension shows an empty
      state on pages no one has saved, so reviewers should test on a URL known
      to be on Are.na. Without a Premium login a reviewer cannot exercise the
      extension at all, and it will be rejected as non-functional.
- [ ] Prepare screenshots (1280×800 or 640×400, at least one, up to five)
      showing the side panel with real results, and a 440×280 small promo
      tile.

## Housekeeping

- [x] Choose and add a `LICENSE` file — MIT, added at the repo root and
      linked from the README.
- [ ] Once the Store listing exists, update the README's "Install → Chrome"
      section to link the listing (keep the release-zip instructions as a
      secondary/dev path if desired).
- [ ] Build the Store upload zip with `npm run package` and upload
      **`dist/arena-connections-chrome-<version>-webstore.zip`** — the
      `key`-stripped one. The plain `arena-connections-chrome-<version>.zip`
      keeps `key` because it is the load-unpacked artifact attached to GitHub
      Releases; uploading that one to the Store is rejected. Never upload a
      `dist/` folder zipped by hand.

A version bump is **not** required for the first Store upload — the Store has
never seen this extension, so `0.2.0` is a valid first version there. (The
bump rule in `docs/firefox.md` is AMO's: Mozilla rejects re-signing a version
it has already signed.) Subsequent Store uploads do each need a fresh version
in both `package.json` and `public/manifest.base.json`.
