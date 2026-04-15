import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const releaseTarget = process.argv[2];

if (!releaseTarget) {
  console.error('Usage: npm run release:prepare -- <patch|minor|major|version>');
  process.exit(1);
}

execFileSync('npm', ['version', releaseTarget, '--no-git-tag-version'], {
  stdio: 'inherit'
});

const packageJsonPath = resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const nextVersion = packageJson.version;

console.log('');
console.log(`Prepared release version ${nextVersion}.`);
console.log('Next steps:');
console.log('  1. Review package.json and package-lock.json.');
console.log('  2. Run: npm run release:pr:check');
console.log(`  3. Open a release PR with the Release template and a neutral title like release: ${nextVersion}.`);
