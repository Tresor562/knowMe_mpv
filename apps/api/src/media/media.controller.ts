import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUploadSessionDto, GrantMediaAccessDto } from './dto/media.dto';
import { MediaService } from './media.service';

@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  createUploadSession(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateUploadSessionDto
  ) {
    return this.media.createUploadSession(req.user.userId, dto);
  }

  @Post('uploads/:id/complete')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024, files: 1 }
    })
  )
  completeUpload(
    @Req() req: { user: { userId: string } },
    @Param('id') sessionId: string,
    @Headers('x-upload-token') uploadToken: string | undefined,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.media.completeUpload(
      req.user.userId,
      sessionId,
      uploadToken,
      file
    );
  }

  @Get('mine')
  listMine(@Req() req: { user: { userId: string } }) {
    return this.media.listMine(req.user.userId);
  }

  @Post(':id/download-grant')
  issueDownloadGrant(
    @Req() req: { user: { userId: string } },
    @Param('id') assetId: string
  ) {
    return this.media.issueDownloadGrant(req.user.userId, assetId);
  }

  @Get(':id/content')
  async content(
    @Req() req: { user: { userId: string } },
    @Param('id') assetId: string,
    @Query('token') token?: string
  ) {
    const content = await this.media.readContent(req.user.userId, assetId, token);
    return new StreamableFile(content.buffer, {
      type: content.mimeType,
      disposition: `attachment; filename="${content.fileName.replace(/["\r\n]/g, '_')}"`
    });
  }

  @Post(':id/grants')
  grantAccess(
    @Req() req: { user: { userId: string } },
    @Param('id') assetId: string,
    @Body() dto: GrantMediaAccessDto
  ) {
    return this.media.grantAccess(req.user.userId, assetId, dto);
  }

  @Delete(':id/grants/:granteeId')
  revokeAccess(
    @Req() req: { user: { userId: string } },
    @Param('id') assetId: string,
    @Param('granteeId') granteeId: string
  ) {
    return this.media.revokeAccess(req.user.userId, assetId, granteeId);
  }

  @Delete(':id')
  deleteAsset(
    @Req() req: { user: { userId: string } },
    @Param('id') assetId: string
  ) {
    return this.media.deleteAsset(req.user.userId, assetId);
  }
}
