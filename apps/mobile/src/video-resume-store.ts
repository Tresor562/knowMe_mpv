import AsyncStorage from '@react-native-async-storage/async-storage';
import { publicPostVideoId } from './offline-public-video-model';
import { nextVideoResumes, resumablePosition, safeVideoResumes, type VideoResume } from './video-resume-model';

const STORAGE_KEY = 'knowme.public-video.resume.v1';
let writeQueue: Promise<void> = Promise.resolve();

async function readPositions(): Promise<VideoResume[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return safeVideoResumes(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function getPublicVideoResume(url: string): Promise<number | null> {
  const id = publicPostVideoId(url);
  if (!id) return null;
  await writeQueue.catch(() => undefined);
  const entry = (await readPositions()).find(item => item.id === id);
  return entry ? resumablePosition(entry.positionMs, entry.durationMs) : null;
}

export function savePublicVideoResume(url: string, positionMs: number, durationMs: number): Promise<void> {
  const id = publicPostVideoId(url);
  if (!id) return Promise.resolve();
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const saved = await readPositions();
    const updated = nextVideoResumes(saved, id, positionMs, durationMs, Date.now());
    if (JSON.stringify(saved) !== JSON.stringify(updated)) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  });
  return writeQueue;
}
