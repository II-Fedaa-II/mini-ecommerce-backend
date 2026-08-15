import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderLine } from '../schemas/order.schema';

export interface CreateOrderData {
  userId: string;
  items: OrderLine[];
  total: number;
}

export abstract class OrdersRepository {
  abstract create(data: CreateOrderData): Promise<OrderDocument>;
  abstract findById(id: string): Promise<OrderDocument | null>;
}

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
}
