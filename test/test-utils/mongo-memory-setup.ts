import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import {
  ADMIN_ROLE_NAME,
  ALL_PERMISSIONS,
  CUSTOMER_ROLE_NAME,
  PERMISSIONS,
} from '../../src/modules/roles/permissions';
import { RolesService } from '../../src/modules/roles/roles.service';

export interface E2ETestContext {
  app: INestApplication;
  mongod: MongoMemoryServer;
}

/** Boilerplate DB/app bootstrap shared by every e2e spec — no test assertions live here. */
export async function createE2ETestApp(): Promise<E2ETestContext> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return { app, mongod };
}

/**
 * Every user needs a role now that RBAC is in place. Specs that only care about
 * shopper flows use this to get the built-in roles without repeating the setup.
 */
export async function seedBuiltInRoles(
  app: INestApplication,
): Promise<{ adminRoleId: string; customerRoleId: string }> {
  const rolesService = app.get(RolesService);

  const admin = await rolesService.ensureSeeded({
    name: ADMIN_ROLE_NAME,
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  });
  const customer = await rolesService.ensureSeeded({
    name: CUSTOMER_ROLE_NAME,
    permissions: [PERMISSIONS.PRODUCTS_READ],
    isSystem: true,
  });

  return {
    adminRoleId: admin._id.toString(),
    customerRoleId: customer._id.toString(),
  };
}

export async function closeE2ETestApp(ctx: E2ETestContext): Promise<void> {
  await ctx.app.close();
  await ctx.mongod.stop();
}
