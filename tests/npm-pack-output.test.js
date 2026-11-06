import { describe, expect, it } from 'vitest';
import { parseNpmPackOutput } from '../scripts/parse-npm-pack-output.mjs';

const manifest = { name: 'image-drop-input', filename: 'image-drop-input-0.3.4.tgz' };

describe('npm pack JSON compatibility', () => {
  it.each([
    JSON.stringify([manifest]),
    JSON.stringify({ 'image-drop-input': manifest }),
    `prepack: build started\n[build] complete\n${JSON.stringify([manifest], null, 2)}\n`,
    `prepack: build started\n{build log}\n${JSON.stringify({ 'image-drop-input': manifest }, null, 2)}\n`
  ])('reads a single manifest after lifecycle output', (output) => {
    expect(parseNpmPackOutput(output)).toEqual(manifest);
  });

  it.each([
    '[]', '{}', 'null', 'not JSON', '[null]', '[{}]',
    JSON.stringify([manifest, manifest]),
    JSON.stringify({ first: manifest, second: manifest }),
    `${JSON.stringify([manifest])}\ntrailing non-JSON output`
  ])('rejects missing, ambiguous, or malformed manifests: %s', (output) => {
    expect(() => parseNpmPackOutput(output)).toThrow();
  });
});
