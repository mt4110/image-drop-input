import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const directoryArg = args.shift();
let expectedPackageJsonPath;
let githubOutputPath;
let outputName = 'tarball';

function usage() {
  console.error(
    [
      'Usage: node scripts/resolve-npm-tarball.mjs <directory> [options]',
      '',
      'Options:',
      '  --expect-package-json <path>  Require the tarball name to match package name/version.',
      '  --github-output <path>        Append the resolved tarball path to a GitHub output file.',
      '  --output-name <name>          GitHub output name. Defaults to tarball.'
    ].join('\n')
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function expectedTarballNameFromPackageJson(packageJsonPath) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  if (!packageJson.name || !packageJson.version) {
    fail(`Expected ${packageJsonPath} to include package name and version.`);
  }

  const packageName = packageJson.name.replace(/^@/, '').replace('/', '-');
  return `${packageName}-${packageJson.version}.tgz`;
}

function formatPathForShell(filePath) {
  const relativePath = relative(process.cwd(), filePath);
  const path =
    relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)
      ? relativePath
      : filePath;
  const pathIsAbsolute = isAbsolute(path);
  const normalizedPath = path.split(sep).join('/');

  if (
    pathIsAbsolute ||
    normalizedPath.startsWith('.') ||
    normalizedPath.startsWith('/') ||
    /^[a-zA-Z]:\//.test(normalizedPath)
  ) {
    return normalizedPath;
  }

  return `./${normalizedPath}`;
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  const value = args[index + 1];

  if (arg === '--expect-package-json') {
    if (!value) {
      usage();
      fail('Missing value for --expect-package-json.');
    }

    expectedPackageJsonPath = resolve(process.cwd(), value);
    index += 1;
  } else if (arg === '--github-output') {
    if (!value) {
      usage();
      fail('Missing value for --github-output.');
    }

    githubOutputPath = value;
    index += 1;
  } else if (arg === '--output-name') {
    if (!value) {
      usage();
      fail('Missing value for --output-name.');
    }

    outputName = value;
    index += 1;
  } else {
    usage();
    fail(`Unknown option: ${arg}`);
  }
}

if (!directoryArg) {
  usage();
  process.exit(1);
}

const directory = resolve(process.cwd(), directoryArg);
let entries;

try {
  entries = readdirSync(directory, { withFileTypes: true });
} catch (error) {
  fail(`Could not read tarball directory ${directory}: ${error.message}`);
}

const tarballs = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
  .map((entry) => join(directory, entry.name))
  .sort();

if (tarballs.length !== 1) {
  console.error(
    `Expected exactly one npm package tarball in ${directory}, found ${tarballs.length}.`
  );

  if (tarballs.length > 0) {
    console.error('Found tarballs:');

    for (const tarball of tarballs) {
      console.error(`  ${formatPathForShell(tarball)}`);
    }
  }

  process.exit(1);
}

const tarball = tarballs[0];

if (expectedPackageJsonPath) {
  const expectedTarballName = expectedTarballNameFromPackageJson(expectedPackageJsonPath);

  if (basename(tarball) !== expectedTarballName) {
    fail(
      `Expected tarball ${expectedTarballName}, received ${basename(tarball)}.`
    );
  }
}

const outputPath = formatPathForShell(tarball);

if (githubOutputPath) {
  appendFileSync(githubOutputPath, `${outputName}=${outputPath}\n`);
}

console.log(`Resolved npm package tarball: ${outputPath}`);
