import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { ProductsService } from '../src/modules/products/products.service';
import { UsersService } from '../src/modules/users/users.service';
import {
  closeE2ETestApp,
  createE2ETestApp,
  E2ETestContext,
} from './test-utils/mongo-memory-setup';

describe('Orders (e2e)', () => {
  let ctx: E2ETestContext;
  let accessToken: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await createE2ETestApp();

    const productsService = ctx.app.get(ProductsService);
    await productsService.createMany([
      {
        title: 'Checkout Product',
        description: 'For e2e checkout tests',
        price: 15,
        stock: 5,
        variants: [],
      },
    ]);
    const [product] = await productsService.findAll();
    productId = product.id;

    const usersService = ctx.app.get(UsersService);
    const passwordHash = await AuthService.hashPassword('Password123!');
    await usersService.createUser({
      email: 'e2e-orders@test.com',
      passwordHash,
      name: 'E2E User',
    });

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-orders@test.com', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  const auth = () => `Bearer ${accessToken}`;

  it('rejects checkout on an empty cart', async () => {
    await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', auth())
      .expect(409);
  });

  it('checks out the cart, decrements stock, and clears the cart', async () => {
    await request(ctx.app.getHttpServer())
      .post('/cart')
      .set('Authorization', auth())
      .send({ productId, quantity: 2 })
      .expect(201);

    const order = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', auth())
      .expect(201);
    expect(order.body.total).toBe(30);
    expect(order.body.items).toHaveLength(1);

    const cart = await request(ctx.app.getHttpServer())
      .get('/cart')
      .set('Authorization', auth())
      .expect(200);
    expect(cart.body.items).toHaveLength(0);

    const product = await request(ctx.app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', auth())
      .expect(200);
    expect(product.body.stock).toBe(3);
  });

  it('retrieves the placed order by id', async () => {
    const order = await request(ctx.app.getHttpServer())
      .post('/cart')
      .set('Authorization', auth())
      .send({ productId, quantity: 1 })
      .expect(201)
      .then(() =>
        request(ctx.app.getHttpServer())
          .post('/orders')
          .set('Authorization', auth())
          .expect(201),
      );

    const fetched = await request(ctx.app.getHttpServer())
      .get(`/orders/${order.body.id}`)
      .set('Authorization', auth())
      .expect(200);

    expect(fetched.body.id).toBe(order.body.id);
  });

  it('returns 404 for an order belonging to another user', async () => {
    const usersService = ctx.app.get(UsersService);
    const passwordHash = await AuthService.hashPassword('Password123!');
    await usersService.createUser({
      email: 'e2e-orders-2@test.com',
      passwordHash,
      name: 'Other User',
    });
    const otherLogin = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-orders-2@test.com', password: 'Password123!' });

    await request(ctx.app.getHttpServer())
      .post('/cart')
      .set('Authorization', auth())
      .send({ productId, quantity: 1 })
      .expect(201);
    const order = await request(ctx.app.getHttpServer())
      .post('/orders')
      .set('Authorization', auth())
      .expect(201);

    await request(ctx.app.getHttpServer())
      .get(`/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .expect(404);
  });
});
