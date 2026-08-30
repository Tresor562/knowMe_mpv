#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DELIVERY_FILE = /^KMD_(\d{3})_DELIVERY\.md$/;
const MIN_BASELINE_KMD = 60;

function parseHeading(content) {
  const firstLine = String(content).split(/\r?\n/, 1)[0] ?? '';
  const match = /^# KMD-(\d{3})(?:\s|$)/.exec(firstLine);
  return match ? Number(match[1]) : null;
}

export async function inspectKmdDeliveryRegistry({ roadmapDir = 'docs/roadmap' } = {}) {
  const absoluteDir = resolve(roadmapDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const deliveries = [];
  const errors = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = DELIVERY_FILE.exec(entry.name);
    if (!match) continue;

    const id = Number(match[1]);
    const path = resolve(absoluteDir, entry.name);
    const content = await readFile(path, 'utf8');
    const headingId = parseHeading(content);
    if (headingId !== id) {
      errors.push(`${entry.name} must start with a matching '# KMD-${match[1]}' heading.`);
    }
    deliveries.push({ id, file: entry.name });
  }

  deliveries.sort((a, b) => a.id - b.id || a.file.localeCompare(b.file));
  const seen = new Set();
  for (const delivery of deliveries) {
    if (seen.has(delivery.id)) errors.push(`KMD-${String(delivery.id).padStart(3, '0')} has more than one canonical delivery document.`);
    seen.add(delivery.id);
  }

  const maxId = deliveries.length ? deliveries.at(-1).id : null;
  if (maxId === null || maxId < MIN_BASELINE_KMD) {
    errors.push(`Delivery registry must contain canonical delivery documents through at least KMD-${String(MIN_BASELINE_KMD).padStart(3, '0')}.`);
  }

  return { ok: errors.length === 0, errors, deliveries, maxId };
}

async function runCli() {
  const result = await inspectKmdDeliveryRegistry();
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`KMD delivery registry valid: ${result.deliveries.length} canonical delivery document(s); highest documented id KMD-${String(result.maxId).padStart(3, '0')}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: KMD delivery registry preflight could not be completed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
