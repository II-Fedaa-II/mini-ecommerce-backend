import { RoleDocument } from '../schemas/role.schema';

export class RoleResponseDto {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;

  static fromDocument(role: RoleDocument): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = role._id.toString();
    dto.name = role.name;
    dto.permissions = role.permissions;
    dto.isSystem = role.isSystem;
    return dto;
  }
}
