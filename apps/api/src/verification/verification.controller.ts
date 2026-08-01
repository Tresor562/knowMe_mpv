import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateVerificationRequestDto,
  ReviewVerificationDto,
  UploadVerificationDocumentDto
} from './dto/verification.dto';
import { VerificationEligibilityGuard } from './verification-eligibility.guard';
import { VerificationService } from './verification.service';

const ACTIVE_REQUEST_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'NEEDS_INFO'
]);
const BLOCKING_IDENTITY_STATUSES = new Set(['ACTIVE', 'SUSPENDED']);

@UseGuards(JwtAuthGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const state = await this.verification.me(req.user.userId);
    const hasActiveRequest = Boolean(
      state.request && ACTIVE_REQUEST_STATUSES.has(state.request.status)
    );
    return {
      ...state,
      canCreateNew:
        !hasActiveRequest &&
        !BLOCKING_IDENTITY_STATUSES.has(state.identityStatus)
    };
  }

  @UseGuards(VerificationEligibilityGuard)
  @Post('requests')
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateVerificationRequestDto
  ) {
    return this.verification.createRequest(req.user.userId, dto);
  }

  @Post('requests/:id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 }
    })
  )
  upload(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UploadVerificationDocumentDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.verification.uploadDocument(
      req.user.userId,
      id,
      dto.kind,
      file
    );
  }

  @Delete('requests/:requestId/documents/:documentId')
  removeDocument(
    @Req() req: { user: { userId: string } },
    @Param('requestId') requestId: string,
    @Param('documentId') documentId: string
  ) {
    return this.verification.deleteDocument(
      req.user.userId,
      requestId,
      documentId
    );
  }

  @Post('requests/:id/submit')
  submit(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.verification.submit(req.user.userId, id);
  }

  @Post('requests/:id/cancel')
  cancel(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.verification.cancel(req.user.userId, id);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.VERIFICATION_MANAGE)
@Controller('admin/verifications')
export class AdminVerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  queue(@Query('status') status?: string) {
    return this.verification.adminQueue(status?.trim().toUpperCase());
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.verification.adminDetail(id);
  }

  @Post(':id/start-review')
  startReview(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.verification.startReview(req.user.userId, id);
  }

  @Patch(':id/decision')
  review(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto
  ) {
    return this.verification.review(req.user.userId, id, dto);
  }

  @Get(':requestId/documents/:documentId')
  async document(
    @Param('requestId') requestId: string,
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const document = await this.verification.readPrivateDocument(
      requestId,
      documentId
    );
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', String(document.sizeBytes));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.fileName}"`
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(document.buffer);
  }
}
