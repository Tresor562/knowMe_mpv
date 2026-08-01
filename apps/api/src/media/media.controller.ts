import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4'
]);

@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads',
        filename: (_request, file, callback) => {
          const extension = extname(file.originalname)
            .toLowerCase()
            .replace(/[^.a-z0-9]/g, '')
            .slice(0, 10);

          callback(
            null,
            `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`
          );
        }
      }),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        callback(null, allowedMimeTypes.has(file.mimetype));
      }
    })
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Fichier absent, trop volumineux ou type non autorisé.'
      );
    }

    return {
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: this.media.toPublicUrl(file.filename)
    };
  }
}
