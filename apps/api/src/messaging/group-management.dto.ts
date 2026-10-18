import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

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

/** Each permission is independently optional to permit safe partial updates. */
export class UpdateGroupPermissionsDto {
  @IsOptional() @IsBoolean()
  membersCanSendMessages?:boolean;

  @IsOptional() @IsBoolean()
  membersCanSendMedia?:boolean;

  @IsOptional() @IsBoolean()
  membersCanSendStickers?:boolean;

  @IsOptional() @IsBoolean()
  membersCanEditInfo?:boolean;

  @IsOptional() @IsBoolean()
  membersCanAddMembers?:boolean;
}
