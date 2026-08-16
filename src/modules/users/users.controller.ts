import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../roles/permissions';
import { RolesService } from '../roles/roles.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();

    // One batched role lookup for the whole page of users, not a query per user.
    const roleIds = [...new Set(users.map((user) => user.roleId.toString()))];
    const roles = await this.rolesService.findManyByIds(roleIds);
    const roleMap = new Map(
      roles.map((role) => [
        role._id.toString(),
        {
          id: role._id.toString(),
          name: role.name,
          permissions: role.permissions,
        },
      ]),
    );

    return users.map((user) =>
      UserResponseDto.fromDocument(user, roleMap.get(user.roleId.toString())),
    );
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const role = await this.rolesService.findByIdOrThrow(dto.roleId);
    const passwordHash = await AuthService.hashPassword(dto.password);
    const user = await this.usersService.createAccount({
      email: dto.email,
      passwordHash,
      name: dto.name,
      roleId: dto.roleId,
    });

    return UserResponseDto.fromDocument(user, {
      id: role._id.toString(),
      name: role.name,
      permissions: role.permissions,
    });
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.USERS_ASSIGN_ROLE)
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ): Promise<UserResponseDto> {
    const role = await this.rolesService.findByIdOrThrow(dto.roleId);
    const user = await this.usersService.assignRole(id, dto.roleId);

    return UserResponseDto.fromDocument(user, {
      id: role._id.toString(),
      name: role.name,
      permissions: role.permissions,
    });
  }
}
