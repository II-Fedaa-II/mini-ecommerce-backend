import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { PERMISSIONS } from '../src/modules/roles/permissions';
import { UsersService } from '../src/modules/users/users.service';
import {
  closeE2ETestApp,
  createE2ETestApp,
  E2ETestContext,
  seedBuiltInRoles,
} from './test-utils/mongo-memory-setup';

describe('Roles / RBAC (e2e)', () => {
  let ctx: E2ETestContext;
  let adminToken: string;
  let customerToken: string;
  let adminRoleId: string;
  let customerRoleId: string;

  const password = 'Password123!';

  async function login(email: string): Promise<string> {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    ({ adminRoleId, customerRoleId } = await seedBuiltInRoles(ctx.app));

    const usersService = ctx.app.get(UsersService);
    const passwordHash = await AuthService.hashPassword(password);

    await usersService.createUser({
      email: 'rbac-admin@test.com',
      passwordHash,
      name: 'Admin',
      roleId: adminRoleId,
    });
    await usersService.createUser({
      email: 'rbac-customer@test.com',
      passwordHash,
      name: 'Customer',
      roleId: customerRoleId,
    });

    adminToken = await login('rbac-admin@test.com');
    customerToken = await login('rbac-customer@test.com');
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  const asAdmin = () => `Bearer ${adminToken}`;
  const asCustomer = () => `Bearer ${customerToken}`;

  it('lets an admin list roles', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/roles')
      .set('Authorization', asAdmin())
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('denies a customer access to role management', async () => {
    await request(ctx.app.getHttpServer())
      .get('/roles')
      .set('Authorization', asCustomer())
      .expect(403);
  });

  it('denies a customer product writes but allows product reads', async () => {
    await request(ctx.app.getHttpServer())
      .get('/products')
      .set('Authorization', asCustomer())
      .expect(200);

    await request(ctx.app.getHttpServer())
      .post('/products')
      .set('Authorization', asCustomer())
      .send({
        title: 'Sneaky',
        description: 'Should not work',
        price: 1,
        stock: 1,
        variants: [],
      })
      .expect(403);
  });

  it('lets an admin create a product', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/products')
      .set('Authorization', asAdmin())
      .send({
        title: 'Admin Product',
        description: 'Created in an e2e test',
        price: 25,
        stock: 4,
        variants: [],
      })
      .expect(201);

    expect(res.body.title).toBe('Admin Product');
  });

  it('lets an admin create a role and assign it, granting exactly those permissions', async () => {
    const roleRes = await request(ctx.app.getHttpServer())
      .post('/roles')
      .set('Authorization', asAdmin())
      .send({
        name: 'catalogue-editor',
        permissions: [PERMISSIONS.PRODUCTS_WRITE],
      })
      .expect(201);
    const editorRoleId = (roleRes.body as { id: string }).id;

    const usersService = ctx.app.get(UsersService);
    const editor = await usersService.createUser({
      email: 'rbac-editor@test.com',
      passwordHash: await AuthService.hashPassword(password),
      name: 'Editor',
      roleId: editorRoleId,
    });
    expect(editor.email).toBe('rbac-editor@test.com');

    const editorToken = await login('rbac-editor@test.com');

    // Granted permission works...
    await request(ctx.app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        title: 'Editor Product',
        description: 'Made by the editor role',
        price: 10,
        stock: 2,
        variants: [],
      })
      .expect(201);

    // ...but a permission that was not granted is still refused.
    await request(ctx.app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(403);
  });

  it('blocks privilege escalation: roles:manage alone cannot mutate roles', async () => {
    const roleRes = await request(ctx.app.getHttpServer())
      .post('/roles')
      .set('Authorization', asAdmin())
      .send({ name: 'role-viewer', permissions: [PERMISSIONS.ROLES_MANAGE] })
      .expect(201);
    const viewerRoleId = (roleRes.body as { id: string }).id;

    const usersService = ctx.app.get(UsersService);
    await usersService.createUser({
      email: 'rbac-viewer@test.com',
      passwordHash: await AuthService.hashPassword(password),
      name: 'Role Viewer',
      roleId: viewerRoleId,
    });
    const viewerToken = await login('rbac-viewer@test.com');

    // The permission grants read access to role management...
    await request(ctx.app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    // ...but creating a role — which is how it would grant itself more power — is
    // gated on the literal admin role, so escalation is refused.
    await request(ctx.app.getHttpServer())
      .post('/roles')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'self-promoted',
        permissions: [PERMISSIONS.PRODUCTS_DELETE],
      })
      .expect(403);
  });

  it('refuses to modify or delete a built-in role', async () => {
    await request(ctx.app.getHttpServer())
      .patch(`/roles/${customerRoleId}`)
      .set('Authorization', asAdmin())
      .send({ permissions: [] })
      .expect(403);

    await request(ctx.app.getHttpServer())
      .delete(`/roles/${adminRoleId}`)
      .set('Authorization', asAdmin())
      .expect(403);
  });

  it('rejects an unknown permission key', async () => {
    await request(ctx.app.getHttpServer())
      .post('/roles')
      .set('Authorization', asAdmin())
      .send({ name: 'bogus-role', permissions: ['products:teleport'] })
      .expect(400);
  });

  it('lets an admin list users and reassign a role', async () => {
    const usersRes = await request(ctx.app.getHttpServer())
      .get('/users')
      .set('Authorization', asAdmin())
      .expect(200);

    const customer = (
      usersRes.body as { id: string; email: string; role: { name: string } }[]
    ).find((user) => user.email === 'rbac-customer@test.com')!;
    expect(customer.role.name).toBe('customer');

    const updated = await request(ctx.app.getHttpServer())
      .patch(`/users/${customer.id}/role`)
      .set('Authorization', asAdmin())
      .send({ roleId: adminRoleId })
      .expect(200);

    expect(updated.body.role.name).toBe('admin');
  });

  it('refuses a duplicate product title, case-insensitively', async () => {
    await request(ctx.app.getHttpServer())
      .post('/products')
      .set('Authorization', asAdmin())
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
      .set('Authorization', asAdmin())
      .send({
        title: 'unique WIDGET',
        description: 'Same product, different casing',
        price: 9,
        stock: 3,
        variants: [],
      })
      .expect(409);
  });
});
