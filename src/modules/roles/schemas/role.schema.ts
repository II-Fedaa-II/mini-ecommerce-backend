import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Role {
  @Prop({ required: true, unique: true, trim: true, index: true })
  name: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  /** Built-in roles (admin/customer) cannot be renamed or deleted from the UI. */
  @Prop({ default: false })
  isSystem: boolean;
}

export type RoleDocument = HydratedDocument<Role>;
export const RoleSchema = SchemaFactory.createForClass(Role);
