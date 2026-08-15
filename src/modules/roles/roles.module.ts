import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MongooseRolesRepository,
  RolesRepository,
} from './repositories/roles.repository';
import { Role, RoleSchema } from './schemas/role.schema';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
  ],
  controllers: [RolesController],
  providers: [
    RolesService,
    { provide: RolesRepository, useClass: MongooseRolesRepository },
  ],
  exports: [RolesService],
})
export class RolesModule {}
