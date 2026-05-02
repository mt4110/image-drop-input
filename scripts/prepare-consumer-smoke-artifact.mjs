import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const artifactsDir = fileURLToPath(new URL('../.artifacts/', import.meta.url));
const fixedTarballName = 'image-drop-input.tgz';
const consumerFixtureDirs = [
  fileURLToPath(new URL('../consumer-fixtures/root-types/', import.meta.url)),
  fileURLToPath(new URL('../consumer-fixtures/headless-cjs/', import.meta.url)),
  fileURLToPath(new URL('../consumer-fixtures/vite-react-ui/', import.meta.url))
];

rmSync(artifactsDir, {
  force: true,
  recursive: true
});
mkdirSync(artifactsDir, {
  recursive: true
});

const packOutput = execFileSync(
  'npm',
  [
    'pack',
    '--json',
    '--silent',
    '--ignore-scripts',
    '--pack-destination',
    artifactsDir
  ],
  {
    encoding: 'utf8'
  }
);
const packResult = JSON.parse(packOutput);
const tarballName = packResult[0]?.filename;

if (!tarballName) {
  throw new Error('npm pack did not return a tarball filename.');
}

const sourcePath = join(artifactsDir, tarballName);
const targetPath = join(artifactsDir, fixedTarballName);

renameSync(sourcePath, targetPath);

consumerFixtureDirs.forEach((fixtureDir) => {
  rmSync(join(fixtureDir, 'node_modules', 'image-drop-input'), {
    force: true,
    recursive: true
  });
});

console.log(`Prepared ${targetPath}`);
