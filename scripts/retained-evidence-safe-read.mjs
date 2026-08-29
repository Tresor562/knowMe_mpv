import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

export const RETAINED_EVIDENCE_FILE_LIMITS = Object.freeze({
  item: 2 * 1024 * 1024,
  artifact: 256 * 1024 * 1024,
  worksheet: 2 * 1024 * 1024,
  reviewReceipt: 1024 * 1024,
});

const READ_CHUNK_BYTES = 64 * 1024;

function sameFileIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}

export function sameRetainedEvidenceFileState(a, b) {
  return sameFileIdentity(a, b)
    && a.size === b.size
    && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs;
}

async function readBounded(handle, maxBytes, encoding) {
  const chunks = [];
  let total = 0;
  while (true) {
    const chunk = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
    if (bytesRead === 0) break;
    if (total + bytesRead > maxBytes) {
      throw new Error(`file exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
    }
    chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
    total += bytesRead;
  }
  const bytes = Buffer.concat(chunks, total);
  return encoding ? bytes.toString(encoding) : bytes;
}

export async function readRetainedEvidenceFile(path, label, { encoding, maxBytes } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`${label} has an invalid retained evidence size limit.`);
  }

  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`);
  }
  if (before.size > BigInt(maxBytes)) {
    throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
  }

  const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error) {
    if (error?.code === 'ELOOP') {
      throw new Error(`${label} must be a regular non-symlink file.`);
    }
    throw error;
  }

  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameRetainedEvidenceFileState(before, opened)) {
      throw new Error(`${label} changed while being opened; refusing release evidence.`);
    }
    if (opened.size > BigInt(maxBytes)) {
      throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
    }

    let bytes;
    try {
      bytes = await readBounded(handle, maxBytes, encoding);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('file exceeds')) {
        throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
      }
      throw error;
    }

    const descriptorAfter = await handle.stat({ bigint: true });
    if (!descriptorAfter.isFile() || !sameRetainedEvidenceFileState(opened, descriptorAfter)) {
      throw new Error(`${label} changed in place while being read; refusing release evidence.`);
    }

    const after = await lstat(path, { bigint: true });
    if (!after.isFile() || after.isSymbolicLink() || !sameRetainedEvidenceFileState(descriptorAfter, after)) {
      throw new Error(`${label} changed while being read; refusing release evidence.`);
    }
    if (after.size > BigInt(maxBytes)) {
      throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
