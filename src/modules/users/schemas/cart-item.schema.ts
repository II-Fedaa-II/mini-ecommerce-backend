import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: true })
export class SelectedVariant {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  value: string;
}
export const SelectedVariantSchema =
  SchemaFactory.createForClass(SelectedVariant);

@Schema({ _id: true })
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: [SelectedVariantSchema], default: [] })
  selectedVariants: SelectedVariant[];
}
export const CartItemSchema = SchemaFactory.createForClass(CartItem);
