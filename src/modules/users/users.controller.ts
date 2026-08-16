import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../roles/permissions';
import { RolesService } from '../roles/roles.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
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
  list(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.list(query);
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
