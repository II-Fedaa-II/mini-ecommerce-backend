import { IsMongoId } from 'class-validator';

export class AssignRoleDto {
  @IsMongoId()
  roleId: string;
}
