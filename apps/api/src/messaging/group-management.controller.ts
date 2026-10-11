import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from '../moderation/moderation.service';
import { AddGroupMembersDto, SetGroupMemberRoleDto, UpdateGroupDto } from './group-management.dto';
import { GroupManagementService } from './group-management.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations/:id/group')
export class GroupManagementController {
  constructor(
    private readonly groups: GroupManagementService,
    private readonly moderation: ModerationService
  ) {}

  @Get()
  details(@Req() req: {user: {userId: string}}, @Param('id') id: string) {
    return this.groups.details(req.user.userId, id);
  }

  @Patch()
  async update(@Req() req: {user: {userId: string}},
    @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId, action: 'POST_CREATE',
      content: `${dto.title ?? ''} ${dto.description ?? ''}`, targetId: id
    });
    return this.groups.update(req.user.userId, id, dto);
  }

  @Post('members')
  addMembers(@Req() req: {user: {userId: string}},
    @Param('id') id: string, @Body() dto: AddGroupMembersDto) {
    return this.groups.addMembers(req.user.userId, id, dto.userIds);
  }

  @Patch('members/:userId/role')
  role(@Req() req: {user: {userId: string}}, @Param('id') id: string,
    @Param('userId') memberId: string, @Body() dto: SetGroupMemberRoleDto) {
    return this.groups.setRole(req.user.userId, id, memberId, dto.role);
  }

  @Delete('members/:userId')
  remove(@Req() req: {user: {userId: string}}, @Param('id') id: string,
    @Param('userId') memberId: string) {
    return this.groups.removeMember(req.user.userId, id, memberId);
  }
}
