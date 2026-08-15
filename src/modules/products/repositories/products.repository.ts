import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';

export interface CreateProductData {
  title: string;
  description: string;
  price: number;
  stock: number;
  variants: { name: string; options: string[] }[];
}

export abstract class ProductsRepository {
  abstract findAll(): Promise<ProductDocument[]>;
  abstract findById(id: string): Promise<ProductDocument | null>;
  abstract findByIds(ids: string[]): Promise<ProductDocument[]>;
  abstract create(data: CreateProductData): Promise<ProductDocument>;
  abstract createMany(data: CreateProductData[]): Promise<ProductDocument[]>;
  abstract update(
    id: string,
    data: Partial<CreateProductData>,
  ): Promise<ProductDocument | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract decrementStock(
    id: string,
    amount: number,
  ): Promise<ProductDocument | null>;
  abstract decrementManyStock(
    updates: { productId: string; amount: number }[],
  ): Promise<void>;
  abstract count(): Promise<number>;
}

@Injectable()
export class MongooseProductsRepository implements ProductsRepository {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  findAll(): Promise<ProductDocument[]> {
    return this.productModel.find().sort({ createdAt: 1 }).exec();
  }

  findById(id: string): Promise<ProductDocument | null> {
    return this.productModel.findById(id).exec();
  }

  // Batched by design — avoids the N+1 of calling findById once per cart/order line item.
  findByIds(ids: string[]): Promise<ProductDocument[]> {
    return this.productModel.find({ _id: { $in: ids } }).exec();
  }

  create(data: CreateProductData): Promise<ProductDocument> {
    return this.productModel.create(data);
  }

  async createMany(data: CreateProductData[]): Promise<ProductDocument[]> {
    return this.productModel.insertMany(data);
  }

  update(
    id: string,
    data: Partial<CreateProductData>,
  ): Promise<ProductDocument | null> {
    return this.productModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.productModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  decrementStock(id: string, amount: number): Promise<ProductDocument | null> {
    return this.productModel
      .findByIdAndUpdate(id, { $inc: { stock: -amount } }, { new: true })
      .exec();
  }

  // One bulkWrite round trip for the whole order, regardless of line-item count — not a
  // decrementStock() call per line.
  async decrementManyStock(
    updates: { productId: string; amount: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.productModel.bulkWrite(
      updates.map(({ productId, amount }) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $inc: { stock: -amount } },
        },
      })),
    );
  }

  count(): Promise<number> {
    return this.productModel.countDocuments().exec();
  }
}
