import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import {
  closeE2ETestApp,
  createE2ETestApp,
  E2ETestContext,
  seedBuiltInRoles,
} from './test-utils/mongo-memory-setup';

describe('Auth (e2e)', () => {
  let ctx: E2ETestContext;
  const email = 'e2e-auth@test.com';
  const password = 'Password123!';

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    const { customerRoleId } = await seedBuiltInRoles(ctx.app);
    const usersService = ctx.app.get(UsersService);
    const passwordHash = await AuthService.hashPassword(password);
    await usersService.createUser({
      email,
      passwordHash,
      name: 'E2E User',
      roleId: customerRoleId,
    });
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  it('logs in with valid credentials and sets a refresh cookie', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(email);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects invalid credentials', async () => {
    await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('returns 401 on a protected route without a token', async () => {
    await request(ctx.app.getHttpServer()).get('/products').expect(401);
  });

  it('rotates the refresh token and revokes the whole family if the old one is replayed', async () => {
    const agent = request.agent(ctx.app.getHttpServer());
    const loginRes = await agent
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const originalCookie = loginRes.headers['set-cookie'];

    // Legitimate rotation — the agent's cookie jar now holds the new refresh token.
    await agent.post('/auth/refresh').expect(200);

    // Replaying the original (already-rotated) cookie must be rejected...
    await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401);

    // ...and must have burned the whole family, so even the freshly-rotated cookie is now dead.
    await agent.post('/auth/refresh').expect(401);
  });
});
