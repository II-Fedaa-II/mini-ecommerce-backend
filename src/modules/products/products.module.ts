import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MongooseProductsRepository,
  ProductsRepository,
} from './repositories/products.repository';
import { Product, ProductSchema } from './schemas/product.schema';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    { provide: ProductsRepository, useClass: MongooseProductsRepository },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
