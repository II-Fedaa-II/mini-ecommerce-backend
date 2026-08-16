import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderLine } from '../schemas/order.schema';

export interface CreateOrderData {
  userId: string;
  items: OrderLine[];
  total: number;
  idempotencyKey?: string;
}

export interface OrderPageQuery {
  /** Exact match — used for a customer's own order history. */
  userId?: string;
  /** Set match — used for the admin listing once a customer search resolves to accounts. */
  userIds?: string[];
  page: number;
  limit: number;
}

export interface OrderPageResult {
  items: OrderDocument[];
  total: number;
}

export abstract class OrdersRepository {
  abstract create(data: CreateOrderData): Promise<OrderDocument>;
  abstract findById(id: string): Promise<OrderDocument | null>;
  abstract findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderDocument | null>;
  abstract findPage(query: OrderPageQuery): Promise<OrderPageResult>;
}

/** Mongo's duplicate-key error code, raised when the idempotency index rejects a replay. */
export const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class MongooseOrdersRepository implements OrdersRepository {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  create(data: CreateOrderData): Promise<OrderDocument> {
    return this.orderModel.create(data);
  }

  findById(id: string): Promise<OrderDocument | null> {
    return this.orderModel.findById(id).exec();
  }

  findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderDocument | null> {
    return this.orderModel.findOne({ userId, idempotencyKey }).exec();
  }

  async findPage(query: OrderPageQuery): Promise<OrderPageResult> {
    const filter: Record<string, unknown> = {};
    if (query.userId) filter.userId = query.userId;
    else if (query.userIds) filter.userId = { $in: query.userIds };

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }
}
