#!/usr/bin/env node
// Asserts that a release tag, package.json's version, and
// public/manifest.base.json's version all agree, so a `v0.3.0` release can't
// ship artifacts named 0.2.0. Run by .github/workflows/release.yml before
// packaging; also runnable by hand: `node scripts/check-release-version.mjs v0.3.0`.
//
// The two files are checked against each other because they already have to
// move together for other reasons — AMO rejects re-signing a version it has
// seen, and it reads manifest.base.json (see docs/firefox.md).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readVersion = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), 'utf8')).version;

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: node scripts/check-release-version.mjs <tag>   (e.g. v0.3.0)');
  process.exit(1);
}

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(
    `Release tag "${tag}" is not of the form v<major>.<minor>.<patch> (e.g. v0.3.0).\n` +
      'Releases are triggered by pushing such a tag; a workflow_dispatch run from a ' +
      'branch instead of a tag lands here too.',
  );
  process.exit(1);
}

const tagVersion = tag.slice(1);
const packageVersion = readVersion('package.json');
const manifestVersion = readVersion('public/manifest.base.json');

const mismatches = [
  ['package.json', packageVersion],
  ['public/manifest.base.json', manifestVersion],
].filter(([, version]) => version !== tagVersion);

if (mismatches.length > 0) {
  console.error(`Release tag ${tag} expects version ${tagVersion}, but:`);
  for (const [file, version] of mismatches) console.error(`  ${file} is ${version}`);
  console.error(
    '\nThe packaged zips are named from package.json\'s version, so releasing this way would ' +
      'attach mislabelled artifacts. Bump both files to match the tag (they must agree with ' +
      'each other regardless — see docs/firefox.md), then re-tag.',
  );
  process.exit(1);
}

console.log(`Version check passed: ${tag} matches package.json and public/manifest.base.json.`);
