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

describe('Orders (e2e)', () => {
  let ctx: E2ETestContext;
  let accessToken: string;
  let productId: string;
  let customerRoleId: string;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    let adminRoleId: string;
    ({ customerRoleId, adminRoleId } = await seedBuiltInRoles(ctx.app));

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
      roleId: customerRoleId,
    });

    await usersService.createUser({
      email: 'e2e-orders-admin@test.com',
      passwordHash,
      name: 'E2E Admin',
      roleId: adminRoleId,
    });

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-orders@test.com', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;

    const adminLogin = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-orders-admin@test.com', password: 'Password123!' });
    adminToken = adminLogin.body.accessToken;
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
      roleId: customerRoleId,
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

  describe('idempotency', () => {
    /** Each test gets its own product so stock assertions are exact and order-independent. */
    async function createProduct(stock: number): Promise<string> {
      const res = await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Idempotency Fixture ${Date.now()}-${Math.random()}`,
          description: 'Fixture for concurrency tests',
          price: 10,
          stock,
          variants: [],
        })
        .expect(201);
      return (res.body as { id: string }).id;
    }

    it('returns the same order and charges stock once when a key is replayed', async () => {
      const freshProductId = await createProduct(5);

      await request(ctx.app.getHttpServer())
        .post('/cart')
        .set('Authorization', auth())
        .send({ productId: freshProductId, quantity: 1 })
        .expect(201);

      const key = `e2e-key-${Date.now()}`;

      const first = await request(ctx.app.getHttpServer())
        .post('/orders')
        .set('Authorization', auth())
        .set('Idempotency-Key', key)
        .expect(201);

      // Replaying the same key must not place a second order.
      const second = await request(ctx.app.getHttpServer())
        .post('/orders')
        .set('Authorization', auth())
        .set('Idempotency-Key', key)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const after = await request(ctx.app.getHttpServer())
        .get(`/products/${freshProductId}`)
        .set('Authorization', auth())
        .expect(200);

      // 5 - 1, not 5 - 2: the replay was answered from the original order.
      expect(after.body.stock).toBe(4);
    });

    it('does not oversell when two checkouts race the last unit', async () => {
      const freshProductId = await createProduct(1);

      await request(ctx.app.getHttpServer())
        .post('/cart')
        .set('Authorization', auth())
        .send({ productId: freshProductId, quantity: 1 })
        .expect(201);

      // No shared key: two genuine attempts contending for the same single unit.
      const results = await Promise.allSettled([
        request(ctx.app.getHttpServer())
          .post('/orders')
          .set('Authorization', auth()),
        request(ctx.app.getHttpServer())
          .post('/orders')
          .set('Authorization', auth()),
      ]);

      const created = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201,
      );
      expect(created).toHaveLength(1);

      const after = await request(ctx.app.getHttpServer())
        .get(`/products/${freshProductId}`)
        .set('Authorization', auth())
        .expect(200);

      // Never negative: the conditional decrement refused the loser.
      expect(after.body.stock).toBe(0);
    });
  });

  describe('order history', () => {
    let historyUserToken: string;
    let historyUserEmail: string;

    beforeAll(async () => {
      const productRes = await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `History Fixture ${Date.now()}`,
          description: 'Fixture for order-history tests',
          price: 10,
          stock: 100,
          variants: [],
        })
        .expect(201);
      const historyProductId = (productRes.body as { id: string }).id;

      const usersService = ctx.app.get(UsersService);
      const passwordHash = await AuthService.hashPassword('Password123!');
      historyUserEmail = `e2e-history-${Date.now()}@test.com`;
      await usersService.createUser({
        email: historyUserEmail,
        passwordHash,
        name: 'History Customer',
        roleId: customerRoleId,
      });
      const login = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: historyUserEmail, password: 'Password123!' });
      historyUserToken = login.body.accessToken;

      // Three separate orders, not one order of three, so pagination has something to page.
      for (let i = 0; i < 3; i += 1) {
        await request(ctx.app.getHttpServer())
          .post('/cart')
          .set('Authorization', `Bearer ${historyUserToken}`)
          .send({ productId: historyProductId, quantity: 1 })
          .expect(201);
        await request(ctx.app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${historyUserToken}`)
          .expect(201);
      }
    });

    it("lists only the caller's own orders, paginated", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/orders/me')
        .query({ limit: 2, page: 1 })
        .set('Authorization', `Bearer ${historyUserToken}`)
        .expect(200);

      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.totalPages).toBe(2);
    });

    it('includes orders placed within the given date range', async () => {
      const today = new Date().toISOString().slice(0, 10);

      const res = await request(ctx.app.getHttpServer())
        .get('/orders/me')
        .query({ dateFrom: today, dateTo: today })
        .set('Authorization', `Bearer ${historyUserToken}`)
        .expect(200);

      expect(res.body.total).toBe(3);
    });

    it('excludes orders outside the given date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const res = await request(ctx.app.getHttpServer())
        .get('/orders/me')
        .query({ dateTo: yesterday })
        .set('Authorization', `Bearer ${historyUserToken}`)
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.items).toHaveLength(0);
    });

    it('rejects a malformed date filter', async () => {
      await request(ctx.app.getHttpServer())
        .get('/orders/me')
        .query({ dateFrom: 'not-a-date' })
        .set('Authorization', `Bearer ${historyUserToken}`)
        .expect(400);
    });

    it('denies a plain customer the admin order listing', async () => {
      await request(ctx.app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${historyUserToken}`)
        .expect(403);
    });

    it('lets an admin list every order with the placing customer attached', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const mine = (
        res.body.items as { customer: { email: string; name: string } }[]
      ).filter((order) => order.customer.email === historyUserEmail);
      expect(mine.length).toBeGreaterThanOrEqual(1);
      expect(mine[0].customer.name).toBe('History Customer');
    });

    it("lets an admin search orders by the customer's email", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/orders')
        .query({ search: historyUserEmail })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(3);
      expect(
        (res.body.items as { customer: { email: string } }[]).every(
          (order) => order.customer.email === historyUserEmail,
        ),
      ).toBe(true);
    });

    it('returns no results for a search that matches no customer', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/orders')
        .query({ search: 'no-customer-matches-this-string' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });
});
