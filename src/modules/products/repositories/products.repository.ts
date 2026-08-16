import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';

export interface StockUpdate {
  productId: string;
  amount: number;
}

/** Owned here rather than in the DTO layer — the repository is the natural source of
 * truth for which sorts the data layer actually supports. */
export const PRODUCT_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'title_asc',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const SORT_MAP: Record<ProductSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  title_asc: { title: 1 },
};

export interface ProductPageQuery {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort: ProductSort;
  page: number;
  limit: number;
}

export interface ProductPageResult {
  items: ProductDocument[];
  total: number;
}

export interface CreateProductData {
  title: string;
  description: string;
  price: number;
  stock: number;
  variants: { name: string; options: string[] }[];
  imageUrl?: string | null;
}

export abstract class ProductsRepository {
  abstract findAll(): Promise<ProductDocument[]>;
  abstract findPage(query: ProductPageQuery): Promise<ProductPageResult>;
  abstract findById(id: string): Promise<ProductDocument | null>;
  abstract findByIds(ids: string[]): Promise<ProductDocument[]>;
  abstract findByTitle(title: string): Promise<ProductDocument | null>;
  abstract create(data: CreateProductData): Promise<ProductDocument>;
  abstract createMany(data: CreateProductData[]): Promise<ProductDocument[]>;
  abstract update(
    id: string,
    data: Partial<CreateProductData>,
  ): Promise<ProductDocument | null>;
  /**
   * Applies the edit only if the stored version still matches the one the editor read.
   * Returns null when it does not, which the service reports as a conflict.
   */
  abstract updateIfVersionMatches(
    id: string,
    expectedVersion: number,
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

  /**
   * Count and find run as two round trips rather than one `$facet` aggregation — at this
   * catalogue's scale the extra query costs nothing, and keeping both as plain `find`/
   * `countDocuments` calls is far easier to read than an aggregation pipeline would be.
   */
  async findPage(query: ProductPageQuery): Promise<ProductPageResult> {
    const filter: FilterQuery<ProductDocument> = {};

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceRange: { $gte?: number; $lte?: number } = {};
      if (query.minPrice !== undefined) priceRange.$gte = query.minPrice;
      if (query.maxPrice !== undefined) priceRange.$lte = query.maxPrice;
      filter.price = priceRange;
    }

    if (query.inStock) {
      filter.stock = { $gt: 0 };
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(SORT_MAP[query.sort])
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
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

  createMany(data: CreateProductData[]): Promise<ProductDocument[]> {
    return this.productModel.insertMany(data) as unknown as Promise<
      ProductDocument[]
    >;
  }

  update(
    id: string,
    data: Partial<CreateProductData>,
  ): Promise<ProductDocument | null> {
    return this.productModel
      .findByIdAndUpdate(id, { ...data, $inc: { version: 1 } }, { new: true })
      .exec();
  }

  updateIfVersionMatches(
    id: string,
    expectedVersion: number,
    data: Partial<CreateProductData>,
  ): Promise<ProductDocument | null> {
    // The version is part of the filter, so a stale edit matches no document at all
    // rather than overwriting whatever the other editor just saved.
    return this.productModel
      .findOneAndUpdate(
        { _id: id, version: expectedVersion },
        { ...data, $inc: { version: 1 } },
        { new: true },
      )
      .exec();
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
