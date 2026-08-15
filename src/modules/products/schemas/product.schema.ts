import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ProductVariant {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], required: true })
  options: string[];
}
export const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant);

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true, index: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
