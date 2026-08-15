import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [UsersModule, ProductsModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
