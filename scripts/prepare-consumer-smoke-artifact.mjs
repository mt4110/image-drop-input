import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const artifactsDir = fileURLToPath(new URL('../.artifacts/', import.meta.url));
const fixedTarballName = 'image-drop-input.tgz';

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

console.log(`Prepared ${targetPath}`);
