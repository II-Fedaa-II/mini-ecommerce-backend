import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: true })
export class OrderLine {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  quantity: number;

  @Prop({ type: [{ name: String, value: String }], default: [] })
  selectedVariants: { name: string; value: string }[];

  @Prop({ required: true })
  subtotal: number;
}
export const OrderLineSchema = SchemaFactory.createForClass(OrderLine);

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderLineSchema], required: true })
  items: OrderLine[];

  @Prop({ required: true })
  total: number;

  /**
   * Client-supplied key that makes checkout safe to retry. A double-clicked button or a
   * network retry sends the same key, and the unique index below turns the second write
   * into a duplicate-key error we can answer with the original order.
   */
  @Prop({ type: String, required: false })
  idempotencyKey?: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

// Partial + unique: keys are only unique per user, and orders placed without a key are
// exempt rather than colliding on `null`.
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
