import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve(process.cwd(), '.github/workflows/release.yml');
const failures = [];

function fail(message) {
  failures.push(message);
}

function readWorkflow() {
  try {
    return readFileSync(workflowPath, 'utf8');
  } catch (error) {
    fail(`Could not read release workflow at ${workflowPath}: ${error.message}`);
    return undefined;
  }
}

const workflow = readWorkflow();

if (workflow === undefined) {
  console.error('Release workflow verification failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

const lines = workflow.split(/\r?\n/);

function getIndent(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function getBlock(headerPattern, label) {
  const startIndex = lines.findIndex((line) => headerPattern.test(line));

  if (startIndex === -1) {
    fail(`Expected release workflow to include ${label}.`);
    return '';
  }

  const startIndent = getIndent(lines[startIndex]);
  let endIndex = lines.length;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() && getIndent(line) <= startIndent) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join('\n');
}

function requireIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    fail(message);
  }
}

function requireAbsent(source, denied, message) {
  if (source.includes(denied)) {
    fail(message);
  }
}

const concurrencyBlock = getBlock(/^concurrency:\s*$/, 'top-level concurrency');
const verifyJob = getBlock(/^  verify:\s*$/, 'verify job');
const publishJob = getBlock(/^  publish:\s*$/, 'publish job');

requireIncludes(
  concurrencyBlock,
  'cancel-in-progress: false',
  'Expected release concurrency to keep cancel-in-progress: false.'
);

requireIncludes(
  verifyJob,
  'npm run release:pr:check',
  'Expected verify job to run npm run release:pr:check.'
);
requireIncludes(
  verifyJob,
  'npm pack --pack-destination artifacts',
  'Expected verify job to create the package tarball in artifacts.'
);
requireIncludes(
  verifyJob,
  'node scripts/resolve-npm-tarball.mjs artifacts --expect-package-json package.json --github-output "$GITHUB_OUTPUT"',
  'Expected verify job to resolve exactly one package tarball before upload.'
);
requireIncludes(
  verifyJob,
  'path: ${{ steps.packed-artifact.outputs.tarball }}',
  'Expected verify job to upload the resolved package tarball only.'
);

requireIncludes(publishJob, 'needs: verify', 'Expected publish job to depend on verify.');
requireIncludes(
  publishJob,
  'id-token: write',
  'Expected publish job to request id-token: write for npm Trusted Publishing.'
);
requireIncludes(
  publishJob,
  'actions/download-artifact',
  'Expected publish job to download the verified package artifact.'
);
requireIncludes(
  publishJob,
  'node scripts/resolve-npm-tarball.mjs artifacts --expect-package-json package.json --github-output "$GITHUB_OUTPUT"',
  'Expected publish job to re-check exactly one package tarball before npm publish.'
);
requireIncludes(
  publishJob,
  'npm publish "${{ steps.publish-artifact.outputs.tarball }}" --access public',
  'Expected npm publish to use the explicit resolved tarball path.'
);
requireIncludes(
  publishJob,
  'PUBLISHED_VERSION="$(npm_view_or_empty "$PACKAGE_SPEC" version)"',
  'Expected post-publish verification to check the exact published package version.'
);
requireIncludes(
  publishJob,
  'dist-tags.latest',
  'Expected post-publish verification to check dist-tags.latest.'
);
requireIncludes(
  publishJob,
  'repository.url',
  'Expected post-publish verification to check repository.url.'
);
requireIncludes(
  publishJob,
  'engines.node',
  'Expected post-publish verification to check engines.node.'
);

requireAbsent(
  workflow,
  'NPM_TOKEN',
  'Release workflow must not use NPM_TOKEN for the normal publish path.'
);
requireAbsent(
  workflow,
  'NODE_AUTH_TOKEN',
  'Release workflow must not use NODE_AUTH_TOKEN for the normal publish path.'
);

if (failures.length > 0) {
  console.error('Release workflow verification failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Verified release workflow gates.');
