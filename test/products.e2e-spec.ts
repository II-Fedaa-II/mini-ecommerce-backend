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
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    const { customerRoleId, adminRoleId } = await seedBuiltInRoles(ctx.app);

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

    await usersService.createUser({
      email: 'e2e-products-admin@test.com',
      passwordHash,
      name: 'E2E Admin',
      roleId: adminRoleId,
    });

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-products@test.com', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;

    const adminLogin = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-products-admin@test.com', password: 'Password123!' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  it('returns 401 without a token', async () => {
    await request(ctx.app.getHttpServer()).get('/products').expect(401);
  });

  it('lists products with pagination metadata', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Test Product');
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
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

  describe('duplicate titles', () => {
    it('refuses a second product with the same title', async () => {
      await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Unique Widget',
          description: 'First one wins',
          price: 5,
          stock: 1,
          variants: [],
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Unique Widget',
          description: 'Should be refused',
          price: 9,
          stock: 1,
          variants: [],
        })
        .expect(409);
    });

    it('treats titles as case-insensitive so casing cannot sneak a duplicate through', async () => {
      await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'uNiQuE wIdGeT',
          description: 'Same product, different casing',
          price: 9,
          stock: 1,
          variants: [],
        })
        .expect(409);
    });

    it('lets a product keep its own title when edited', async () => {
      const created = await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Editable Widget',
          description: 'Will be edited',
          price: 5,
          stock: 1,
          variants: [],
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .patch(`/products/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Editable Widget', stock: 12 })
        .expect(200);
    });
  });

  describe('optimistic concurrency', () => {
    it('rejects the second of two edits made from the same starting version', async () => {
      const created = await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Concurrent Edit ${Date.now()}`,
          description: 'Edited by two admins',
          price: 20,
          stock: 5,
          variants: [],
        })
        .expect(201);

      const { id, version } = created.body as { id: string; version: number };

      // Both admins loaded the same version.
      await request(ctx.app.getHttpServer())
        .patch(`/products/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stock: 10, version })
        .expect(200);

      // The second save is based on a version that no longer exists.
      const stale = await request(ctx.app.getHttpServer())
        .patch(`/products/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stock: 99, version })
        .expect(409);

      expect(stale.body.message).toMatch(/changed by someone else/i);

      // The first admin's value survived; the stale write did not land.
      const current = await request(ctx.app.getHttpServer())
        .get(`/products/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(current.body.stock).toBe(10);
    });

    it('accepts a retry once the editor reloads the current version', async () => {
      const created = await request(ctx.app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Retry After Reload ${Date.now()}`,
          description: 'Reloaded before retrying',
          price: 20,
          stock: 5,
          variants: [],
        })
        .expect(201);

      const id = (created.body as { id: string }).id;

      await request(ctx.app.getHttpServer())
        .patch(`/products/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stock: 7,
          version: (created.body as { version: number }).version,
        })
        .expect(200);

      const reloaded = await request(ctx.app.getHttpServer())
        .get(`/products/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(ctx.app.getHttpServer())
        .patch(`/products/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stock: 8,
          version: (reloaded.body as { version: number }).version,
        })
        .expect(200);
    });
  });

  describe('search, filters, and pagination', () => {
    const prefix = `Listing E2E ${Date.now()}`;

    beforeAll(async () => {
      for (const [suffix, price, stock] of [
        ['Alpha', 10, 5],
        ['Beta', 30, 0],
        ['Gamma', 50, 5],
      ] as const) {
        await request(ctx.app.getHttpServer())
          .post('/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: `${prefix} ${suffix}`,
            description: 'Fixture for listing e2e tests',
            price,
            stock,
            variants: [],
          })
          .expect(201);
      }
    });

    it('filters by title search', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/products')
        .query({ search: `${prefix} Beta` })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe(`${prefix} Beta`);
    });

    it('filters by price range', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/products')
        .query({ search: prefix, minPrice: 20, maxPrice: 40 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe(`${prefix} Beta`);
    });

    it('filters to in-stock items only', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/products')
        .query({ search: prefix, inStock: 'true' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const titles = (res.body.items as { title: string }[])
        .map((item) => item.title)
        .sort();
      expect(titles).toEqual([`${prefix} Alpha`, `${prefix} Gamma`].sort());
    });

    it('paginates results', async () => {
      const page1 = await request(ctx.app.getHttpServer())
        .get('/products')
        .query({ search: prefix, limit: 2, page: 1, sort: 'title_asc' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.total).toBe(3);
      expect(page1.body.totalPages).toBe(2);

      const page2 = await request(ctx.app.getHttpServer())
        .get('/products')
        .query({ search: prefix, limit: 2, page: 2, sort: 'title_asc' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items[0].title).toBe(`${prefix} Gamma`);
    });
  });
});
