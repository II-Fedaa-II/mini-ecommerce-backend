import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { ProductsService } from '../src/modules/products/products.service';
import { UsersService } from '../src/modules/users/users.service';
import {
  closeE2ETestApp,
  createE2ETestApp,
  E2ETestContext,
  seedBuiltInRoles,
} from './test-utils/mongo-memory-setup';

describe('Products (e2e)', () => {
  let ctx: E2ETestContext;
  let accessToken: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    const { customerRoleId } = await seedBuiltInRoles(ctx.app);

    const productsService = ctx.app.get(ProductsService);
    await productsService.createMany([
      {
        title: 'Test Product',
        description: 'A product for e2e tests',
        price: 12.5,
        stock: 10,
        variants: [],
      },
    ]);
    const [product] = await productsService.findAll();
    productId = product.id;

    const usersService = ctx.app.get(UsersService);
    const passwordHash = await AuthService.hashPassword('Password123!');
    await usersService.createUser({
      email: 'e2e-products@test.com',
      passwordHash,
      name: 'E2E User',
      roleId: customerRoleId,
    });

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-products@test.com', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  it('returns 401 without a token', async () => {
    await request(ctx.app.getHttpServer()).get('/products').expect(401);
  });

  it('lists all products', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Test Product');
  });

  it('returns product detail by id', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.price).toBe(12.5);
  });

  it('returns 404 for an unknown product id', async () => {
    await request(ctx.app.getHttpServer())
      .get('/products/000000000000000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
