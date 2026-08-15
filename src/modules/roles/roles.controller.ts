import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { ALL_PERMISSIONS, PERMISSIONS } from './permissions';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /** The catalogue of assignable permissions, so the admin UI never hardcodes them. */
  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  listPermissions(): { permissions: string[] } {
    return { permissions: ALL_PERMISSIONS };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  findAll(): Promise<RoleResponseDto[]> {
    return this.rolesService.findAll();
  }

  // Mutations are gated on the literal admin role rather than a permission: if
  // `roles:manage` alone were enough, any role holding it could grant itself every
  // other permission, which would make RBAC self-defeating.
  @Post()
  @UseGuards(AdminOnlyGuard)
  create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(dto.name, dto.permissions);
  }

  @Patch(':id')
  @UseGuards(AdminOnlyGuard)
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.updatePermissions(id, dto.permissions);
  }

  @Delete(':id')
  @UseGuards(AdminOnlyGuard)
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.rolesService.delete(id);
  }
}
