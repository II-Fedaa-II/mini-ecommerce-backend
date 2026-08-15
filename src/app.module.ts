import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import configuration, { AppConfig } from './config/configuration';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Five attempts per minute against a given account from a given address. Generous
    // enough that a person mistyping a password never notices, tight enough that
    // guessing a password becomes impractical.
    ThrottlerModule.forRoot([{ name: 'login', ttl: 60_000, limit: 5 }]),
    // Uploaded product images are served straight from the shared volume.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false, fallthrough: false },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<AppConfig>('app')!.mongoUri,
      }),
    }),
    HealthModule,
    UsersModule,
    ProductsModule,
    AuthModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    RolesModule,
  ],
})
export class AppModule {}
