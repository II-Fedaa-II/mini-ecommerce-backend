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

export abstract class OrdersRepository {
  abstract create(data: CreateOrderData): Promise<OrderDocument>;
  abstract findById(id: string): Promise<OrderDocument | null>;
  abstract findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderDocument | null>;
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
}
