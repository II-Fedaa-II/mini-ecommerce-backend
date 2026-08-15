import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import {
  closeE2ETestApp,
  createE2ETestApp,
  E2ETestContext,
  seedBuiltInRoles,
} from './test-utils/mongo-memory-setup';

describe('Login throttling (e2e)', () => {
  let ctx: E2ETestContext;
  const email = 'throttle-target@test.com';
  const password = 'Password123!';

  beforeAll(async () => {
    ctx = await createE2ETestApp();
    const { customerRoleId } = await seedBuiltInRoles(ctx.app);

    const usersService = ctx.app.get(UsersService);
    await usersService.createUser({
      email,
      passwordHash: await AuthService.hashPassword(password),
      name: 'Throttle Target',
      roleId: customerRoleId,
    });
  });

  afterAll(async () => {
    await closeE2ETestApp(ctx);
  });

  it('blocks repeated password guesses against one account with 429', async () => {
    const attempt = () =>
      request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'WrongPassword1!' });

    // The configured allowance is 5 per minute; the sixth guess must be refused.
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await attempt();
      statuses.push(res.status);
    }

    expect(
      statuses.filter((status) => status === 401).length,
    ).toBeLessThanOrEqual(5);
    expect(statuses).toContain(429);
  });

  it('does not lock out a different account from the same address', async () => {
    // The tracker keys on address *and* email, so one account being throttled must not
    // deny service to everyone else behind the same IP.
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'someone-else@test.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
  });
});
