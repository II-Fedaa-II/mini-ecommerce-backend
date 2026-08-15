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

describe('Cart (e2e)', () => {
  let ctx: E2ETestContext;
  let accessToken: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    const { customerRoleId } = await seedBuiltInRoles(ctx.app);

    const productsService = ctx.app.get(ProductsService);
    await productsService.createMany([
      {
        title: 'Variant Product',
        description: 'Has a Size variant for e2e tests',
        price: 20,
        stock: 3,
        variants: [{ name: 'Size', options: ['S', 'M'] }],
      },
    ]);
    const [product] = await productsService.findAll();
    productId = product.id;

    const usersService = ctx.app.get(UsersService);
    const passwordHash = await AuthService.hashPassword('Password123!');
    await usersService.createUser({
      email: 'e2e-cart@test.com',
      passwordHash,
      name: 'E2E User',
      roleId: customerRoleId,
    });

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-cart@test.com', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  const auth = () => `Bearer ${accessToken}`;

  it('returns 401 without a token', async () => {
    await request(ctx.app.getHttpServer()).get('/cart').expect(401);
  });

  it('rejects a variant value that does not exist on the product', async () => {
    await request(ctx.app.getHttpServer())
      .post('/cart')
      .set('Authorization', auth())
      .send({
        productId,
        quantity: 1,
        selectedVariants: [{ name: 'Size', value: 'XL' }],
      })
      .expect(400);
  });

  it('rejects a quantity above available stock', async () => {
    await request(ctx.app.getHttpServer())
      .post('/cart')
      .set('Authorization', auth())
      .send({ productId, quantity: 999 })
      .expect(409);
  });

  it('adds an item and returns the priced cart', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/cart')
      .set('Authorization', auth())
      .send({
        productId,
        quantity: 2,
        selectedVariants: [{ name: 'Size', value: 'M' }],
      })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(40);
  });

  it('updates the quantity of an existing item', async () => {
    const cart = await request(ctx.app.getHttpServer())
      .get('/cart')
      .set('Authorization', auth())
      .expect(200);
    const itemId = cart.body.items[0].itemId;

    const res = await request(ctx.app.getHttpServer())
      .patch(`/cart/${itemId}`)
      .set('Authorization', auth())
      .send({ quantity: 1 })
      .expect(200);

    expect(res.body.items[0].quantity).toBe(1);
    expect(res.body.total).toBe(20);
  });

  it('removes the item from the cart', async () => {
    const cart = await request(ctx.app.getHttpServer())
      .get('/cart')
      .set('Authorization', auth())
      .expect(200);
    const itemId = cart.body.items[0].itemId;

    const res = await request(ctx.app.getHttpServer())
      .delete(`/cart/${itemId}`)
      .set('Authorization', auth())
      .expect(200);

    expect(res.body.items).toHaveLength(0);
  });
});
