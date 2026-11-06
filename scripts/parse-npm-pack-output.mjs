// npm 11 returns an array; npm 12 returns a map keyed by package name.
// Lifecycle scripts can print before the JSON payload.
export function parseNpmPackOutput(output) {
  const lines = output.split(/\r?\n/);
  let payload;

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^[\[{]/.test(lines[index])) continue;
    try {
      payload = JSON.parse(lines.slice(index).join('\n'));
      break;
    } catch {
      // Keep looking for the complete trailing payload after lifecycle output.
    }
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('npm pack did not return a parseable JSON payload.');
  }

  const manifests = Array.isArray(payload) ? payload : Object.values(payload);
  if (manifests.length !== 1) {
    throw new Error(`Expected npm pack to return one manifest, received ${manifests.length}.`);
  }

  const manifest = manifests[0];
  if (!manifest || typeof manifest !== 'object' || typeof manifest.filename !== 'string' || !manifest.filename) {
    throw new Error('npm pack did not return a valid manifest with a tarball filename.');
  }
  return manifest;
}
