import { Injectable } from '@nestjs/common';
import {
  RoleNameTakenException,
  RoleNotFoundException,
  SystemRoleImmutableException,
  UnknownPermissionException,
} from '../../common/exceptions/domain.exceptions';
import { RoleResponseDto } from './dto/role-response.dto';
import { ALL_PERMISSIONS } from './permissions';
import {
  CreateRoleData,
  RolesRepository,
} from './repositories/roles.repository';
import { RoleDocument } from './schemas/role.schema';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.rolesRepository.findAll();
    return roles.map((role) => RoleResponseDto.fromDocument(role));
  }

  async findByIdOrThrow(id: string): Promise<RoleDocument> {
    const role = await this.rolesRepository.findById(id);
    if (!role) throw new RoleNotFoundException(id);
    return role;
  }

  findByName(name: string): Promise<RoleDocument | null> {
    return this.rolesRepository.findByName(name);
  }

  async findByNameOrThrow(name: string): Promise<RoleDocument> {
    const role = await this.rolesRepository.findByName(name);
    if (!role) throw new RoleNotFoundException(name);
    return role;
  }

  /** Batched — used to attach roles to a list of users without a query per user. */
  findManyByIds(ids: string[]): Promise<RoleDocument[]> {
    return this.rolesRepository.findByIds(ids);
  }

  async create(name: string, permissions: string[]): Promise<RoleResponseDto> {
    this.assertPermissionsAreKnown(permissions);

    const existing = await this.rolesRepository.findByName(name);
    if (existing) throw new RoleNameTakenException(name);

    const role = await this.rolesRepository.create({ name, permissions });
    return RoleResponseDto.fromDocument(role);
  }

  async updatePermissions(
    id: string,
    permissions: string[],
  ): Promise<RoleResponseDto> {
    this.assertPermissionsAreKnown(permissions);

    const role = await this.findByIdOrThrow(id);
    // The built-in admin role must keep full access, otherwise an admin could lock
    // every account out of role management and leave the system unadministrable.
    if (role.isSystem) throw new SystemRoleImmutableException(role.name);

    const updated = await this.rolesRepository.updatePermissions(
      id,
      permissions,
    );
    if (!updated) throw new RoleNotFoundException(id);
    return RoleResponseDto.fromDocument(updated);
  }

  async delete(id: string): Promise<void> {
    const role = await this.findByIdOrThrow(id);
    if (role.isSystem) throw new SystemRoleImmutableException(role.name);
    await this.rolesRepository.delete(id);
  }

  ensureSeeded(data: CreateRoleData): Promise<RoleDocument> {
    return this.rolesRepository.create(data);
  }

  /**
   * Bypasses the isSystem check that blocks the admin-facing update endpoint. Built-in
   * roles are code-defined, not admin-customized, so the seed script keeps them synced
   * to whatever the current PERMISSIONS catalogue says they should hold — otherwise a
   * permission added after first deploy would never reach an existing database.
   */
  syncSystemRolePermissions(
    id: string,
    permissions: string[],
  ): Promise<RoleDocument | null> {
    return this.rolesRepository.updatePermissions(id, permissions);
  }

  private assertPermissionsAreKnown(permissions: string[]): void {
    const unknown = permissions.find(
      (permission) => !ALL_PERMISSIONS.includes(permission as never),
    );
    if (unknown) throw new UnknownPermissionException(unknown);
  }
}
