import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // SHA-256 hex digest of the raw token — a fast, deterministic hash so we can look
  // it up by exact match, unlike bcrypt which is deliberately non-deterministic per hash.
  @Prop({ required: true, unique: true, index: true })
  tokenHash: string;

  // Groups every token descended from one login so a replayed, already-rotated
  // token can revoke the whole chain (reuse detection), not just itself.
  @Prop({ required: true, index: true })
  familyId: string;

  @Prop({ default: false })
  revoked: boolean;

  @Prop({ required: true })
  expiresAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
