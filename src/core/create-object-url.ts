import type { ManagedObjectUrl } from './types';

export function createObjectUrl(blob: Blob): ManagedObjectUrl {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Object URLs are unavailable in this environment.');
  }

  const url = URL.createObjectURL(blob);
  let revoked = false;

  return {
    url,
    revoke() {
      if (revoked) {
        return;
      }

      URL.revokeObjectURL(url);
      revoked = true;
    }
  };
}
