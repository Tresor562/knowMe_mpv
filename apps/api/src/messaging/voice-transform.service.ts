import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common';
import { execFile } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { MediaStorageService } from '../media/media-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TransformableVoicePreset } from './dto/transform-voice-message.dto';

const execFileAsync = promisify(execFile);
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export function voiceTransformFilter(preset: TransformableVoicePreset) {
  switch (preset) {
    case 'DEEP':
      return 'asetrate=44100*0.84,aresample=44100,atempo=1.190476,lowpass=f=4200';
    case 'BRIGHT':
      return 'asetrate=44100*1.16,aresample=44100,atempo=0.862069,highshelf=f=2200:g=4';
    case 'ROBOT':
      return 'highpass=f=220,lowpass=f=3600,aecho=0.75:0.8:8:0.35,tremolo=f=32:d=0.55';
  }
}

@Injectable()
export class VoiceTransformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService
  ) {}

  async transform(
    userId: string,
    conversationId: string,
    input: { assetId: string; preset: TransformableVoicePreset }
  ) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!member) {
      throw new ForbiddenException('Accès interdit à cette conversation.');
    }

    const source = await this.prisma.mediaAsset.findFirst({
      where: {
        id: input.assetId,
        ownerId: userId,
        conversationId,
        visibility: 'CONVERSATION',
        status: 'AVAILABLE',
        deletedAt: null
      },
      select: {
        id: true,
        storageKey: true,
        detectedMime: true,
        size: true
      }
    });
    if (!source) {
      throw new ForbiddenException('Ce vocal ne peut pas être transformé.');
    }
    if (
      !['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/wav'].includes(
        source.detectedMime
      )
    ) {
      throw new ForbiddenException('Le média sélectionné n’est pas un vocal.');
    }
    if (source.size > MAX_SOURCE_BYTES) {
      throw new ForbiddenException('Ce vocal est trop volumineux pour être transformé.');
    }

    const sourceBytes = await this.storage.get(source.storageKey);
    const directory = await mkdtemp(join(tmpdir(), 'knowme-voice-'));
    const inputPath = join(directory, 'source.audio');
    const outputPath = join(directory, 'transformed.m4a');

    try {
      await writeFile(inputPath, sourceBytes);
      try {
        await execFileAsync(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-af',
            voiceTransformFilter(input.preset),
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            outputPath
          ],
          {
            timeout: 30_000,
            maxBuffer: 1024 * 1024
          }
        );
      } catch {
        throw new ServiceUnavailableException({
          code: 'VOICE_TRANSFORM_UNAVAILABLE',
          message: 'La transformation de voix est temporairement indisponible.'
        });
      }

      const transformed = await readFile(outputPath);
      if (!transformed.length || transformed.length > MAX_SOURCE_BYTES) {
        throw new ServiceUnavailableException({
          code: 'VOICE_TRANSFORM_INVALID_OUTPUT',
          message: 'Le résultat de la transformation vocale est invalide.'
        });
      }

      const storageKey = `${randomUUID().replace(/-/g, '')}.m4a`;
      await this.storage.put(storageKey, transformed, 'audio/mp4');
      try {
        return await this.prisma.mediaAsset.create({
          data: {
            ownerId: userId,
            storageKey,
            originalName: `voice-${input.preset.toLowerCase()}.m4a`,
            declaredMime: 'audio/mp4',
            detectedMime: 'audio/mp4',
            size: transformed.length,
            sha256: createHash('sha256').update(transformed).digest('hex'),
            purpose: 'MESSAGE',
            visibility: 'CONVERSATION',
            conversationId,
            status: 'AVAILABLE',
            scannerVerdict: 'CLEAN',
            scannerReference: 'server-derived:voice-transform',
            metadata: {
              sourceAssetId: source.id,
              transform: input.preset,
              generatedBy: 'FFMPEG'
            }
          },
          select: {
            id: true,
            status: true,
            detectedMime: true,
            size: true
          }
        });
      } catch (cause) {
        await this.storage.delete(storageKey).catch(() => undefined);
        throw cause;
      }
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
