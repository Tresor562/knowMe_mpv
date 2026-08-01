import { Injectable } from '@nestjs/common';

@Injectable()
export class MediaService {
  toPublicUrl(fileName: string) {
    return `/uploads/${fileName}`;
  }
}
