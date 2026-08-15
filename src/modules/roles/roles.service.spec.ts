import {
  RoleNameTakenException,
  RoleNotFoundException,
  SystemRoleImmutableException,
  UnknownPermissionException,
} from '../../common/exceptions/domain.exceptions';
import { PERMISSIONS } from './permissions';
import { RolesRepository } from './repositories/roles.repository';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let rolesRepository: jest.Mocked<RolesRepository>;

  beforeEach(() => {
    rolesRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByIds: jest.fn(),
      create: jest.fn(),
      updatePermissions: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RolesRepository>;

    service = new RolesService(rolesRepository);
  });

  describe('create', () => {
    it('creates a role with the requested permissions', async () => {
      rolesRepository.findByName.mockResolvedValue(null);
      rolesRepository.create.mockResolvedValue({
        _id: { toString: () => 'role-1' },
        name: 'catalogue-editor',
        permissions: [PERMISSIONS.PRODUCTS_WRITE],
        isSystem: false,
      } as any);

      const result = await service.create('catalogue-editor', [
        PERMISSIONS.PRODUCTS_WRITE,
      ]);

      expect(result.name).toBe('catalogue-editor');
      expect(result.permissions).toEqual([PERMISSIONS.PRODUCTS_WRITE]);
    });

    it('rejects a permission that is not in the catalogue', async () => {
      await expect(
        service.create('bogus', ['products:teleport']),
      ).rejects.toThrow(UnknownPermissionException);
      expect(rolesRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate role name', async () => {
      rolesRepository.findByName.mockResolvedValue({ name: 'editor' } as any);

      await expect(service.create('editor', [])).rejects.toThrow(
        RoleNameTakenException,
      );
      expect(rolesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePermissions', () => {
    it('updates permissions on a custom role', async () => {
      rolesRepository.findById.mockResolvedValue({
        _id: { toString: () => 'role-1' },
        name: 'editor',
        isSystem: false,
      } as any);
      rolesRepository.updatePermissions.mockResolvedValue({
        _id: { toString: () => 'role-1' },
        name: 'editor',
        permissions: [PERMISSIONS.ORDERS_READ],
        isSystem: false,
      } as any);

      const result = await service.updatePermissions('role-1', [
        PERMISSIONS.ORDERS_READ,
      ]);

      expect(result.permissions).toEqual([PERMISSIONS.ORDERS_READ]);
    });

    it('refuses to weaken a built-in role, which would strand the deployment', async () => {
      rolesRepository.findById.mockResolvedValue({
        _id: { toString: () => 'role-admin' },
        name: 'admin',
        isSystem: true,
      } as any);

      await expect(service.updatePermissions('role-admin', [])).rejects.toThrow(
        SystemRoleImmutableException,
      );
      expect(rolesRepository.updatePermissions).not.toHaveBeenCalled();
    });

    it('throws when the role does not exist', async () => {
      rolesRepository.findById.mockResolvedValue(null);
      await expect(service.updatePermissions('missing', [])).rejects.toThrow(
        RoleNotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('refuses to delete a built-in role', async () => {
      rolesRepository.findById.mockResolvedValue({
        name: 'customer',
        isSystem: true,
      } as any);

      await expect(service.delete('role-customer')).rejects.toThrow(
        SystemRoleImmutableException,
      );
      expect(rolesRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes a custom role', async () => {
      rolesRepository.findById.mockResolvedValue({
        name: 'editor',
        isSystem: false,
      } as any);

      await service.delete('role-1');

      expect(rolesRepository.delete).toHaveBeenCalledWith('role-1');
    });
  });
});
