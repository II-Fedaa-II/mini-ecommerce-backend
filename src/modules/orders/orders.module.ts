import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import {
  MongooseOrdersRepository,
  OrdersRepository,
} from './repositories/orders.repository';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    UsersModule,
    ProductsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: OrdersRepository, useClass: MongooseOrdersRepository },
  ],
})
export class OrdersModule {}
