import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

let tarballName = '';

try {
  const packOutput = execFileSync('npm', ['pack', '--json', '--silent'], {
    encoding: 'utf8'
  });
  const jsonMatch = packOutput.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);

  if (!jsonMatch) {
    throw new Error('npm pack did not return a parseable JSON payload.');
  }

  const packResult = JSON.parse(jsonMatch[1]);

  tarballName = packResult[0]?.filename ?? '';

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
