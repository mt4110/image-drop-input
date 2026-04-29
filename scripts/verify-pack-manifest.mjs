import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmPackArgs = ['pack', '--json', '--dry-run', '--workspaces=false'];
const npmWorkspaceConfigKeys = new Set([
  'npm_config_include_workspace_root',
  'npm_config_workspace',
  'npm_config_workspaces'
]);
const packageJsonPath = resolve(process.cwd(), 'package.json');
const readmePath = resolve(process.cwd(), 'README.md');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const expectedTarballFilename = `${packageJson.name}-${packageJson.version}.tgz`;
const expectedMetadata = [
  ['homepage', packageJson.homepage, 'https://mt4110.github.io/image-drop-input/'],
  ['repository.type', packageJson.repository?.type, 'git'],
  [
    'repository.url',
    packageJson.repository?.url,
    'git+https://github.com/mt4110/image-drop-input.git'
  ],
  ['bugs.url', packageJson.bugs?.url, 'https://github.com/mt4110/image-drop-input/issues']
];
const requiredFiles = ['LICENSE', 'README.md', 'README.ja.md', 'package.json'];
const requiredPrefixes = ['dist/', 'docs/'];
const allowedFiles = new Set(requiredFiles);
const allowedPrefixes = requiredPrefixes;
const deniedFiles = new Set([
  'OSS_FOUNDATION_PLAN.md',
  'README_en.md',
  'REPO_PLAN.md',
  'ROADMAP.md'
]);
const deniedPrefixes = [
  '.github/',
  '.private_docs/',
  'examples/',
  'meta/',
  'tests/'
];
const deniedPatterns = [
  /\.zip$/i,
  /\.tgz$/i,
  /\.tar$/i,
  /\.tmp$/i,
  /\.temp$/i,
  /\.bak$/i,
  /\.log$/i,
  /~$/,
  /(^|\/)\.DS_Store$/i,
  /(^|\/)npm-debug\.log/i,
  /(^|\/)(tmp|temp|\.tmp|\.temp)(\/|$)/i,
  /(^|\/)(screenshot|screenshots|screen-shot)(\/|$)/i,
  /(^|\/)Screen Shot \d{4}/i
];
const canonicalReadmeTitle = '# image-drop-input';
const canonicalReadmeSummary =
  'Preview, validate, compress, and upload a single image safely before your form ever submits.';
const failures = [];

function fail(message) {
  failures.push(message);
}

function getRootPackEnv() {
  const env = { ...process.env };

  for (const key of Object.keys(env)) {
    if (npmWorkspaceConfigKeys.has(key.toLowerCase())) {
      delete env[key];
    }
  }

  return env;
}

function parsePackOutput(output) {
  const jsonMatch = output.match(/(\[\s*(?:\{[\s\S]*\}\s*)?\])\s*$/);

  if (!jsonMatch) {
    fail('npm pack did not return a parseable JSON payload.');
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);

    if (!Array.isArray(parsed)) {
      fail('npm pack did not return a JSON array.');
      return undefined;
    }

    if (parsed.length !== 1) {
      fail(`Expected npm pack to return one manifest, received ${parsed.length}.`);
      return undefined;
    }

    if (!parsed[0] || typeof parsed[0] !== 'object') {
      fail('npm pack returned an invalid manifest entry.');
      return undefined;
    }

    return parsed[0];
  } catch (error) {
    fail(`npm pack returned invalid JSON: ${error.message}`);
    return undefined;
  }
}

function getPackedFilePaths(packResult) {
  if (!Array.isArray(packResult.files)) {
    fail('Expected npm pack manifest to include a files array.');
    return new Set();
  }

  const files = new Set();

  for (const [index, file] of packResult.files.entries()) {
    if (!file?.path || typeof file.path !== 'string') {
      fail(`Expected npm pack file entry ${index} to include a string path.`);
      continue;
    }

    files.add(file.path);
  }

  return files;
}

function isAllowedPackPath(path) {
  return allowedFiles.has(path) || allowedPrefixes.some((prefix) => path.startsWith(prefix));
}

function isDeniedPackPath(path) {
  return (
    deniedFiles.has(path) ||
    deniedPrefixes.some((prefix) => path.startsWith(prefix)) ||
    deniedPatterns.some((pattern) => pattern.test(path))
  );
}

function verifyPackMetadata(packResult) {
  if (packResult.name !== packageJson.name) {
    fail(
      `Expected package name ${packageJson.name}, received ${
        packResult.name ?? '(missing)'
      }.`
    );
  }

  if (packResult.version !== packageJson.version) {
    fail(
      `Expected package version ${packageJson.version}, received ${
        packResult.version ?? '(missing)'
      }.`
    );
  }

  if (packResult.filename !== expectedTarballFilename) {
    fail(
      `Expected tarball filename ${expectedTarballFilename}, received ${
        packResult.filename ?? '(missing)'
      }.`
    );
  }
}

function verifyPackageJsonMetadata() {
  for (const [field, actual, expected] of expectedMetadata) {
    if (actual !== expected) {
      fail(
        `Expected package.json ${field} to be ${expected}, received ${
          actual ?? '(missing)'
        }.`
      );
    }
  }
}

function verifyReadmeFace(files) {
  if (!files.has('README.md')) {
    fail('Expected README.md to be included in the packed package.');
    return;
  }

  const firstLines = readFileSync(readmePath, 'utf8').split(/\r?\n/).slice(0, 12);

  if (firstLines[0] !== canonicalReadmeTitle) {
    fail(`Expected README.md to start with the English canonical title: ${canonicalReadmeTitle}`);
  }

  if (!firstLines.includes(canonicalReadmeSummary)) {
    fail('Expected README.md opening lines to include the English canonical summary.');
  }
}

function verifyFiles(files) {
  for (const file of requiredFiles) {
    if (!files.has(file)) {
      fail(`Expected ${file} to be included in the packed package.`);
    }
  }

  for (const prefix of requiredPrefixes) {
    if (![...files].some((file) => file.startsWith(prefix))) {
      fail(`Expected at least one ${prefix} file to be included in the packed package.`);
    }
  }

  for (const file of files) {
    if (isDeniedPackPath(file)) {
      fail(`Packed package must not include ${file}.`);
    } else if (!isAllowedPackPath(file)) {
      fail(`Packed package includes unexpected file: ${file}.`);
    }
  }
}

let packOutput = '';

try {
  packOutput = execFileSync(npmExecutable, npmPackArgs, {
    encoding: 'utf8',
    env: getRootPackEnv()
  });
} catch (error) {
  process.stdout.write(error.stdout ?? '');
  process.stderr.write(error.stderr ?? '');
  process.exit(error.status ?? 1);
}

const packResult = parsePackOutput(packOutput);

if (packResult) {
  const files = getPackedFilePaths(packResult);

  verifyPackMetadata(packResult);
  verifyPackageJsonMetadata();
  verifyFiles(files);
  verifyReadmeFace(files);

  if (failures.length === 0) {
    console.log(
      `Verified pack manifest for ${packageJson.name}@${packageJson.version}: ` +
        `${files.size} files, ${packResult.filename}.`
    );
  }
}

if (failures.length > 0) {
  console.error('Package manifest verification failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}
