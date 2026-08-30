import { lstat, readdir } from 'node:fs/promises';

function sameDirectoryIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino;
}

export async function listStableRetainedEvidenceJsonFiles(directoryPath, label) {
  const before = await lstat(directoryPath);
  if (before.isSymbolicLink() || !before.isDirectory()) {
    throw new Error(`${label} must be a real directory and must not be a symlink.`);
  }

  const entries = (await readdir(directoryPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const after = await lstat(directoryPath);
  if (after.isSymbolicLink() || !after.isDirectory() || !sameDirectoryIdentity(before, after)) {
    throw new Error(`${label} changed while retained evidence files were being enumerated.`);
  }
  if (entries.length === 0) {
    throw new Error(`${label} must contain at least one .json evidence item.`);
  }

  return entries;
}
