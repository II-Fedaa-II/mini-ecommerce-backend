import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CartItem, CartItemSchema } from './cart-item.schema';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [CartItemSchema], default: [] })
  cart: CartItem[];

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  wishlist: Types.ObjectId[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
