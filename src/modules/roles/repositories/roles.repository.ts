import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';

export interface CreateRoleData {
  name: string;
  permissions: string[];
  isSystem?: boolean;
}

export abstract class RolesRepository {
  abstract findAll(): Promise<RoleDocument[]>;
  abstract findById(id: string): Promise<RoleDocument | null>;
  abstract findByName(name: string): Promise<RoleDocument | null>;
  abstract findByIds(ids: string[]): Promise<RoleDocument[]>;
  abstract create(data: CreateRoleData): Promise<RoleDocument>;
  abstract updatePermissions(
    id: string,
    permissions: string[],
  ): Promise<RoleDocument | null>;
  abstract delete(id: string): Promise<boolean>;
}

@Injectable()
export class MongooseRolesRepository implements RolesRepository {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  findAll(): Promise<RoleDocument[]> {
    return this.roleModel.find().sort({ name: 1 }).exec();
  }

  findById(id: string): Promise<RoleDocument | null> {
    return this.roleModel.findById(id).exec();
  }

  findByName(name: string): Promise<RoleDocument | null> {
    return this.roleModel.findOne({ name }).exec();
  }

  // Batched by design — resolving roles for a page of users must not query per user.
  findByIds(ids: string[]): Promise<RoleDocument[]> {
    return this.roleModel.find({ _id: { $in: ids } }).exec();
  }

  create(data: CreateRoleData): Promise<RoleDocument> {
    return this.roleModel.create(data);
  }

  updatePermissions(
    id: string,
    permissions: string[],
  ): Promise<RoleDocument | null> {
    return this.roleModel
      .findByIdAndUpdate(id, { permissions }, { new: true })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.roleModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
