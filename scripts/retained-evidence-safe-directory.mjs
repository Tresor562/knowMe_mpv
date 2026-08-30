import { lstat, readdir } from 'node:fs/promises';

function sameDirectoryIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino;
}

export async function snapshotRetainedEvidenceDirectory(directoryPath, label) {
  const snapshot = await lstat(directoryPath);
  if (snapshot.isSymbolicLink() || !snapshot.isDirectory()) {
    throw new Error(`${label} must be a real directory and must not be a symlink.`);
  }
  return { dev: snapshot.dev, ino: snapshot.ino };
}

export async function assertRetainedEvidenceDirectoryStable(directoryPath, label, expectedIdentity) {
  const current = await lstat(directoryPath);
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    !expectedIdentity ||
    current.dev !== expectedIdentity.dev ||
    current.ino !== expectedIdentity.ino
  ) {
    throw new Error(`${label} changed while retained evidence was being accessed.`);
  }
}

export async function listStableRetainedEvidenceJsonFiles(directoryPath, label) {
  const before = await snapshotRetainedEvidenceDirectory(directoryPath, label);

  const entries = (await readdir(directoryPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));

  await assertRetainedEvidenceDirectoryStable(directoryPath, label, before);
  if (entries.length === 0) {
    throw new Error(`${label} must contain at least one .json evidence item.`);
  }

  return entries;
}
