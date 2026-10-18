import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional() @IsString() @Length(1, 90)
  title?: string;

  @IsOptional() @IsString() @MaxLength(512)
  description?: string;
}

export class AddGroupMembersDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({each: true})
  userIds!: string[];
}

export class SetGroupMemberRoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role!: 'ADMIN' | 'MEMBER';
}

/** Admin-only ability to restrict group conversations to administrators. */
export class UpdateGroupPermissionsDto {
  @IsIn(['ALL','ADMINS'])
  sendMessages!: 'ALL'|'ADMINS';
}
