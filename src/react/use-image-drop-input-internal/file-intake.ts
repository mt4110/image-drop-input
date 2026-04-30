import { matchesAcceptRule, splitAcceptRules } from '../../core/validate-image';

function extractFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return [];
  }

  const files: File[] = [];

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();

      if (file) {
        files.push(file);
      }
    }
  }

  return files.length > 0 ? files : Array.from(dataTransfer.files);
}

export function extractFile(dataTransfer: DataTransfer | null, accept?: string): File | null {
  const files = extractFiles(dataTransfer);

  if (files.length === 0) {
    return null;
  }

  const acceptRules = accept ? splitAcceptRules(accept) : [];

  if (acceptRules.length > 0) {
    const acceptedFile = files.find((file) =>
      acceptRules.some((rule) => matchesAcceptRule(file, rule))
    );

    if (acceptedFile) {
      return acceptedFile;
    }

    const imageFile = files.find((file) => file.type.startsWith('image/'));

    return imageFile ?? files[0] ?? null;
  }

  const imageFile = files.find((file) => file.type.startsWith('image/'));

  return imageFile ?? null;
}
