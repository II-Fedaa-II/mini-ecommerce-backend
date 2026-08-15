import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export abstract class RefreshTokenRepository {
  abstract create(data: CreateRefreshTokenData): Promise<RefreshTokenDocument>;
  abstract findByHash(tokenHash: string): Promise<RefreshTokenDocument | null>;
  abstract revoke(id: string): Promise<void>;
  abstract revokeFamily(familyId: string): Promise<void>;
}

@Injectable()
export class MongooseRefreshTokenRepository implements RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly model: Model<RefreshTokenDocument>,
  ) {}

  create(data: CreateRefreshTokenData): Promise<RefreshTokenDocument> {
    return this.model.create(data);
  }

  findByHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ tokenHash }).exec();
  }

  async revoke(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { revoked: true }).exec();
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.model.updateMany({ familyId }, { revoked: true }).exec();
  }
}
