import {
  Body, Controller, Delete, Get, Header, Param, Patch, Req, StreamableFile, UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupAvatarService } from './group-avatar.service';

class SetGroupAvatarDto {
  @IsString() @IsNotEmpty() @MaxLength(256)
  mediaAssetId!: string;
}

/** Reading a private group photo requires membership on every request.
 * Clients fetch as an authenticated blob; a bare <img> cannot pass JWT. */
@UseGuards(JwtAuthGuard)
@Controller('conversations/:id/group/avatar')
export class GroupAvatarController {
  constructor(private readonly avatars:GroupAvatarService) {}

  @Get('capabilities')
  capabilities(@Req() req:{user:{userId:string}},@Param('id') conversationId:string){
    return this.avatars.capabilities(req.user.userId,conversationId);
  }

  @Get()
  @Header('Cache-Control','private, no-store')
  async image(@Req() req:{user:{userId:string}},@Param('id') conversationId:string){
    const {buffer,mimeType}=await this.avatars.read(req.user.userId,conversationId);
    return new StreamableFile(buffer,{
      type:mimeType,
      disposition:'inline'
    });
  }

  @Patch()
  update(@Req() req:{user:{userId:string}},@Param('id') conversationId:string,
    @Body() dto:SetGroupAvatarDto){
    return this.avatars.update(req.user.userId,conversationId,dto.mediaAssetId);
  }

  @Delete()
  remove(@Req() req:{user:{userId:string}},@Param('id') conversationId:string){
    return this.avatars.remove(req.user.userId,conversationId);
  }
}
