import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

/**
 * Abstract class used as both the TypeScript interface and the Nest DI token —
 * services depend on this, never on the Mongoose model directly, so the
 * persistence implementation is swappable/mockable in unit tests.
 */
export abstract class UsersRepository {
  abstract create(data: CreateUserData): Promise<UserDocument>;
  abstract findById(id: string): Promise<UserDocument | null>;
  abstract findByEmail(email: string): Promise<UserDocument | null>;
  abstract findByEmailWithPassword(email: string): Promise<UserDocument | null>;
  abstract save(user: UserDocument): Promise<UserDocument>;
  abstract findByIds(ids: string[]): Promise<UserDocument[]>;
}

@Injectable()
export class MongooseUsersRepository implements UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  create(data: CreateUserData): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  save(user: UserDocument): Promise<UserDocument> {
    return user.save();
  }

  findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }
}
