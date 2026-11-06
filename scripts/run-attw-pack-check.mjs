import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { parseNpmPackOutput } from './parse-npm-pack-output.mjs';

let tarballName = '';

try {
  const packOutput = execFileSync('npm', ['pack', '--json', '--silent'], {
    encoding: 'utf8'
  });
  tarballName = parseNpmPackOutput(packOutput).filename;

  if (!tarballName) {
    throw new Error('npm pack did not return a tarball filename.');
  }

  execFileSync(
    'attw',
    [tarballName, '--profile', 'node16', '--entrypoints', '.', './headless'],
    {
      stdio: 'inherit'
    }
  );
} finally {
  if (tarballName) {
    rmSync(tarballName, {
      force: true
    });
  }
}
