import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ProductVariant {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], required: true })
  options: string[];
}
export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

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

  @Prop({ type: String, default: null })
  imageUrl: string | null;

  /**
   * Bumped on every edit. An update must present the version it read, so two admins
   * editing the same product concurrently cannot silently overwrite each other —
   * the second write is rejected instead of winning by arriving last.
   */
  @Prop({ required: true, default: 1 })
  version: number;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
