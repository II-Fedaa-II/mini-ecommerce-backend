import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';
import { ProductsService } from '../modules/products/products.service';
import { UsersService } from '../modules/users/users.service';
import { SEED_PRODUCTS } from './products.data';

const DEMO_EMAIL = 'demo@mini-ecommerce.test';
const DEMO_PASSWORD = 'Password123!';

async function seed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);

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
  const existingUser = await usersService.findByEmail(DEMO_EMAIL);
  if (!existingUser) {
    const passwordHash = await AuthService.hashPassword(DEMO_PASSWORD);
    await usersService.createUser({
      email: DEMO_EMAIL,
      passwordHash,
      name: 'Demo Customer',
    });
    logger.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    logger.log('Skipped demo user seed — already exists');
  }

  await app.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
