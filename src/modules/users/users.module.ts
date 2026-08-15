import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesModule } from '../roles/roles.module';
import {
  MongooseUsersRepository,
  UsersRepository,
} from './repositories/users.repository';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    RolesModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: UsersRepository, useClass: MongooseUsersRepository },
  ],
  exports: [UsersService],
})
export class UsersModule {}
