import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

export interface E2ETestContext {
  app: INestApplication;
  mongod: MongoMemoryServer;
}

/** Boilerplate DB/app bootstrap shared by every e2e spec — no test assertions live here. */
export async function createE2ETestApp(): Promise<E2ETestContext> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return { app, mongod };
}

export async function closeE2ETestApp(ctx: E2ETestContext): Promise<void> {
  await ctx.app.close();
  await ctx.mongod.stop();
}
