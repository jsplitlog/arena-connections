#!/usr/bin/env node
// Builds each requested target and zips its dist/<target>/ output into
// dist/arena-connections-<target>-<version>.zip — the artifact users install,
// and what .github/workflows/release.yml attaches to a GitHub Release. Chrome
// additionally gets a `key`-stripped *-webstore.zip for Store upload; see the
// stripChromeKey comment below for why the two cannot be swapped. See
// docs/cross-browser-plan.md's WS4 section for the acceptance criteria this
// implements.
//
// Dependency-free: the build step shells out to `npm run build:<target>`
// (already the source of truth for how a target is built — see package.json
// and vite.config.ts) and archiving shells out to the system `zip` binary via
// node:child_process. `zip` ships with macOS and most Linux distros; if it's
// missing this fails loudly up front instead of silently producing nothing.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './build-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const requestedTargets = process.argv.slice(2);
for (const target of requestedTargets) {
  if (!TARGETS.includes(target)) {
    console.error(`Unknown target "${target}". Expected one of: ${TARGETS.join(', ')}.`);
    process.exit(1);
  }
}
const targets = requestedTargets.length > 0 ? requestedTargets : TARGETS;

const assertZipAvailable = () => {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch {
    console.error(
      'The "zip" command is not available on this system. It ships with macOS and most Linux ' +
        'distros by default (e.g. `apt-get install zip` on Debian/Ubuntu if it is missing); ' +
        'install it and re-run `npm run package`.',
    );
    process.exit(1);
  }
};

// Chrome's `key` manifest field pins a stable extension ID. That ID decides the
// OAuth redirect URI (`chrome.identity.getRedirectURL('oauth2')` →
// `https://<extension-id>.chromiumapp.org/oauth2`), and only the pinned ID's URI
// is registered on the Are.na OAuth application — see docs/store-readiness.md.
//
// So Chrome needs two different zips, and shipping the wrong one breaks sign-in:
//
//   - Load-unpacked install (what releases hand to users): `key` RETAINED. Drop
//     it and Chrome derives the ID from the install path, which differs per
//     machine, so every user gets an unregistered redirect URI and OAuth fails.
//   - Chrome Web Store upload: `key` STRIPPED, because the Store rejects
//     packages containing one and assigns its own ID.
//
// dist/chrome/manifest.json on disk is never modified; the strip happens only in
// the staging copy used for the store zip.
const stripChromeKey = (manifest) => {
  const { key, ...rest } = manifest;
  return rest;
};

const writeZip = (stagingDir, zipName) => {
  const zipPath = resolve(root, 'dist', zipName);
  rmSync(zipPath, { force: true });
  // -X: drop extra file attributes/timestamps for a more reproducible archive; -r: recurse.
  // -x: keep Finder droppings (.DS_Store etc.) out of store uploads.
  execFileSync('zip', ['-r', '-X', zipPath, '.', '-x', '.*', '*/.*'], { cwd: stagingDir, stdio: 'inherit' });
  console.log(`Wrote dist/${zipName}`);
  return zipPath;
};

const packageTarget = (target) => {
  const distDir = resolve(root, 'dist', target);

  console.log(`\nBuilding ${target}...`);
  try {
    execFileSync('npm', ['run', `build:${target}`], { cwd: root, stdio: 'inherit' });
  } catch {
    console.error(`\n\`npm run build:${target}\` failed — fix the build before packaging ${target}.`);
    process.exit(1);
  }
  if (!existsSync(resolve(distDir, 'manifest.json'))) {
    console.error(
      `dist/${target}/manifest.json is missing after \`npm run build:${target}\` — the build did ` +
        'not produce the expected output.',
    );
    process.exit(1);
  }

  const staging = mkdtempSync(resolve(tmpdir(), `arena-connections-${target}-`));
  try {
    cpSync(distDir, staging, { recursive: true });

    // The plain <target> name is always the artifact a user installs, so it is
    // the one release workflows and README can point at without qualification.
    const zips = [writeZip(staging, `arena-connections-${target}-${version}.zip`)];

    if (target === 'chrome') {
      const manifestPath = resolve(staging, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.key === undefined) {
        console.error(
          'dist/chrome/manifest.json has no `key` field. The load-unpacked zip just written ' +
            'would give every user a different extension ID and a redirect URI that is not ' +
            'registered with Are.na, so OAuth sign-in would fail. Restore `key` in ' +
            'public/manifest.chrome.json (see docs/store-readiness.md).',
        );
        process.exit(1);
      }
      writeFileSync(manifestPath, `${JSON.stringify(stripChromeKey(manifest), null, 2)}\n`);
      zips.push(writeZip(staging, `arena-connections-chrome-${version}-webstore.zip`));
    }

    return zips;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

assertZipAvailable();
mkdirSync(resolve(root, 'dist'), { recursive: true });
const zips = targets.flatMap(packageTarget);
console.log(`\nPackaged ${targets.length} target${targets.length === 1 ? '' : 's'}:`);
for (const zip of zips) console.log(`  ${zip}`);
if (targets.includes('chrome')) {
  console.log(
    '\nNote: the plain chrome zip is the load-unpacked install artifact (keeps `key`).\n' +
      'Upload the *-webstore.zip to the Chrome Web Store instead — see docs/store-readiness.md.',
  );
}
