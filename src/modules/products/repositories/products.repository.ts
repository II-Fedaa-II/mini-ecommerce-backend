import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';

export interface StockUpdate {
  productId: string;
  amount: number;
}

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
  abstract findByTitle(title: string): Promise<ProductDocument | null>;
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
  /**
   * Returns the subset of updates that actually applied. Callers need the exact subset,
   * not just a count: compensating a line that never applied would invent stock.
   */
  abstract decrementManyStock(updates: StockUpdate[]): Promise<StockUpdate[]>;
  abstract restoreManyStock(updates: StockUpdate[]): Promise<void>;
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

  /** Case-insensitive exact match, anchored so it cannot be abused as a prefix scan. */
  findByTitle(title: string): Promise<ProductDocument | null> {
    return this.productModel
      .findOne({
        title: {
          $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      })
      .exec();
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

  /**
   * Each line is claimed with a conditional update guarded by `stock: { $gte: amount }`.
   * Checking stock in the service and then decrementing is not atomic — two concurrent
   * checkouts can both pass the check and oversell — so the database is the arbiter: a
   * line whose stock moved underneath it simply does not match.
   *
   * Deliberately one update per line rather than a single bulkWrite: bulkWrite only
   * reports an aggregate `modifiedCount`, and a partial failure has to be compensated
   * line-by-line. Restoring a line that never applied would invent stock out of thin
   * air, so knowing exactly which lines applied matters more here than saving a round
   * trip on a cart that holds a handful of distinct products.
   */
  async decrementManyStock(updates: StockUpdate[]): Promise<StockUpdate[]> {
    const applied: StockUpdate[] = [];

    for (const update of updates) {
      const result = await this.productModel
        .findOneAndUpdate(
          { _id: update.productId, stock: { $gte: update.amount } },
          { $inc: { stock: -update.amount } },
        )
        .exec();

      if (result) applied.push(update);
    }

    return applied;
  }

  /** Compensating write: puts back only the stock that was actually claimed. */
  async restoreManyStock(updates: StockUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    await this.productModel.bulkWrite(
      updates.map(({ productId, amount }) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $inc: { stock: amount } },
        },
      })),
    );
  }

  count(): Promise<number> {
    return this.productModel.countDocuments().exec();
  }
}
