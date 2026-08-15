import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';
import { ProductsService } from '../modules/products/products.service';
import {
  ADMIN_ROLE_NAME,
  ALL_PERMISSIONS,
  CUSTOMER_ROLE_NAME,
  PERMISSIONS,
} from '../modules/roles/permissions';
import { RolesService } from '../modules/roles/roles.service';
import { UsersService } from '../modules/users/users.service';
import { SEED_PRODUCTS } from './products.data';

const DEMO_EMAIL = 'demo@mini-ecommerce.test';
const DEMO_PASSWORD = 'Password123!';
const ADMIN_EMAIL = 'admin@mini-ecommerce.test';
const ADMIN_PASSWORD = 'Admin123!';

async function seed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);

  const rolesService = app.get(RolesService);

  // Built-in roles are marked isSystem so the admin UI cannot delete or weaken them
  // and strand the deployment without an account that can manage roles.
  let adminRole = await rolesService.findByName(ADMIN_ROLE_NAME);
  if (!adminRole) {
    adminRole = await rolesService.ensureSeeded({
      name: ADMIN_ROLE_NAME,
      permissions: ALL_PERMISSIONS,
      isSystem: true,
    });
    logger.log(`Seeded "${ADMIN_ROLE_NAME}" role with all permissions`);
  }

  let customerRole = await rolesService.findByName(CUSTOMER_ROLE_NAME);
  if (!customerRole) {
    customerRole = await rolesService.ensureSeeded({
      name: CUSTOMER_ROLE_NAME,
      permissions: [PERMISSIONS.PRODUCTS_READ],
      isSystem: true,
    });
    logger.log(`Seeded "${CUSTOMER_ROLE_NAME}" role`);
  }

  const productsService = app.get(ProductsService);
  const existingProductCount = await productsService.count();
  if (existingProductCount === 0) {
    await productsService.createMany(SEED_PRODUCTS);
    logger.log(`Seeded ${SEED_PRODUCTS.length} products`);
  } else {
    logger.log(
      `Skipped product seed — ${existingProductCount} product(s) already exist`,
    );
  }

  const usersService = app.get(UsersService);

  const existingCustomer = await usersService.findByEmail(DEMO_EMAIL);
  if (!existingCustomer) {
    await usersService.createUser({
      email: DEMO_EMAIL,
      passwordHash: await AuthService.hashPassword(DEMO_PASSWORD),
      name: 'Demo Customer',
      roleId: customerRole._id.toString(),
    });
    logger.log(`Seeded demo customer: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    logger.log('Skipped demo customer seed — already exists');
  }

  const existingAdmin = await usersService.findByEmail(ADMIN_EMAIL);
  if (!existingAdmin) {
    await usersService.createUser({
      email: ADMIN_EMAIL,
      passwordHash: await AuthService.hashPassword(ADMIN_PASSWORD),
      name: 'Demo Admin',
      roleId: adminRole._id.toString(),
    });
    logger.log(`Seeded demo admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    logger.log('Skipped demo admin seed — already exists');
  }

  await app.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
