import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import {
  CartItemNotFoundException,
  EmailAlreadyRegisteredException,
  UserNotFoundException,
} from '../../common/exceptions/domain.exceptions';
import { RolesService } from '../roles/roles.service';
import { UserResponseDto } from './dto/user-response.dto';
import {
  CreateUserData,
  UserPageQuery,
  UsersRepository,
} from './repositories/users.repository';
import { CartItem } from './schemas/cart-item.schema';
import { UserDocument } from './schemas/user.schema';
import {
  variantSelectionsMatch,
  VariantSelection,
} from './utils/variants.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
  ) {}

  createUser(data: CreateUserData): Promise<UserDocument> {
    return this.usersRepository.create(data);
  }

  /**
   * The one path both self-registration and admin-created accounts go through, so the
   * duplicate-email check can't be skipped by one caller and not the other. Password is
   * already hashed by the time it reaches here — this layer owns identity, not crypto.
   */
  async createAccount(data: CreateUserData): Promise<UserDocument> {
    const existing = await this.usersRepository.findByEmail(data.email);
    if (existing) throw new EmailAlreadyRegisteredException(data.email);
    return this.usersRepository.create(data);
  }

  findAll(): Promise<UserDocument[]> {
    return this.usersRepository.findAll();
  }

  async list(
    query: UserPageQuery,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { items, total } = await this.usersRepository.findPage(query);

    // One batched role lookup for the whole page, not a query per user.
    const roleIds = [...new Set(items.map((user) => user.roleId.toString()))];
    const roles = await this.rolesService.findManyByIds(roleIds);
    const roleMap = new Map(
      roles.map((role) => [
        role._id.toString(),
        {
          id: role._id.toString(),
          name: role.name,
          permissions: role.permissions,
        },
      ]),
    );

    const dtos = items.map((user) =>
      UserResponseDto.fromDocument(user, roleMap.get(user.roleId.toString())),
    );

    return PaginatedResponseDto.create(dtos, total, query.page, query.limit);
  }

  /** Batched by design — the caller resolves customer info for a whole page of orders at once. */
  findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.usersRepository.findByIds(ids);
  }

  searchByEmail(query: string, limit = 50): Promise<UserDocument[]> {
    return this.usersRepository.searchByEmail(query, limit);
  }

  async assignRole(userId: string, roleId: string): Promise<UserDocument> {
    const updated = await this.usersRepository.updateRole(userId, roleId);
    if (!updated) throw new UserNotFoundException(userId);
    return updated;
  }

  countByRoleId(roleId: string): Promise<number> {
    return this.usersRepository.countByRoleId(roleId);
  }

  backfillMissingRoles(roleId: string): Promise<number> {
    return this.usersRepository.assignRoleToUsersWithout(roleId);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findByEmailWithPassword(email);
  }

  async findByIdOrThrow(userId: string): Promise<UserDocument> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UserNotFoundException(userId);
    return user;
  }

  async getCart(userId: string): Promise<CartItem[]> {
    const user = await this.findByIdOrThrow(userId);
    return user.cart;
  }

  async addCartItem(
    userId: string,
    productId: string,
    quantity: number,
    selectedVariants: VariantSelection[],
  ): Promise<CartItem[]> {
    const user = await this.findByIdOrThrow(userId);
    const existing = user.cart.find(
      (item) =>
        item.productId.toString() === productId &&
        variantSelectionsMatch(item.selectedVariants, selectedVariants),
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      user.cart.push({
        productId: new Types.ObjectId(productId),
        quantity,
        selectedVariants,
      });
    }

    await user.save();
    return user.cart;
  }

  async updateCartItem(
    userId: string,
    itemId: string,
    updates: { quantity?: number; selectedVariants?: VariantSelection[] },
  ): Promise<CartItem[]> {
    const user = await this.findByIdOrThrow(userId);
    const item = user.cart.find(
      (entry) =>
        (entry as unknown as { _id: Types.ObjectId })._id.toString() === itemId,
    );
    if (!item) throw new CartItemNotFoundException(itemId);

    if (updates.quantity !== undefined) item.quantity = updates.quantity;
    if (updates.selectedVariants !== undefined)
      item.selectedVariants = updates.selectedVariants;

    await user.save();
    return user.cart;
  }

  async removeCartItem(userId: string, itemId: string): Promise<CartItem[]> {
    const user = await this.findByIdOrThrow(userId);
    const initialLength = user.cart.length;
    user.cart = user.cart.filter(
      (entry) =>
        (entry as unknown as { _id: Types.ObjectId })._id.toString() !== itemId,
    );

    if (user.cart.length === initialLength)
      throw new CartItemNotFoundException(itemId);

    await user.save();
    return user.cart;
  }

  async clearCart(userId: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    user.cart = [] as CartItem[];
    await user.save();
  }

  async getWishlist(userId: string): Promise<Types.ObjectId[]> {
    const user = await this.findByIdOrThrow(userId);
    return user.wishlist;
  }

  async addToWishlist(
    userId: string,
    productId: string,
  ): Promise<Types.ObjectId[]> {
    const user = await this.findByIdOrThrow(userId);
    const alreadyPresent = user.wishlist.some(
      (id) => id.toString() === productId,
    );
    if (!alreadyPresent) user.wishlist.push(new Types.ObjectId(productId));
    await user.save();
    return user.wishlist;
  }

  async removeFromWishlist(
    userId: string,
    productId: string,
  ): Promise<Types.ObjectId[]> {
    const user = await this.findByIdOrThrow(userId);
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();
    return user.wishlist;
  }
}
