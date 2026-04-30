export function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('Something went wrong while processing the image.');
}

export function clampProgressPercent(percent: number): number {
  if (!Number.isFinite(percent)) {
    return 0;
  }

  return Math.min(100, Math.max(0, percent));
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
