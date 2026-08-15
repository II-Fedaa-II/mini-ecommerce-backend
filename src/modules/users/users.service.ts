import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CartItemNotFoundException, UserNotFoundException } from '../../common/exceptions/domain.exceptions';
import { CreateUserData, UsersRepository } from './repositories/users.repository';
import { CartItem } from './schemas/cart-item.schema';
import { UserDocument } from './schemas/user.schema';
import { variantSelectionsMatch, VariantSelection } from './utils/variants.util';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  createUser(data: CreateUserData): Promise<UserDocument> {
    return this.usersRepository.create(data);
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
      (item) => item.productId.toString() === productId && variantSelectionsMatch(item.selectedVariants, selectedVariants),
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      user.cart.push({
        productId: new Types.ObjectId(productId),
        quantity,
        selectedVariants,
      } as CartItem);
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
    const item = user.cart.find((entry) => (entry as unknown as { _id: Types.ObjectId })._id.toString() === itemId);
    if (!item) throw new CartItemNotFoundException(itemId);

    if (updates.quantity !== undefined) item.quantity = updates.quantity;
    if (updates.selectedVariants !== undefined) item.selectedVariants = updates.selectedVariants;

    await user.save();
    return user.cart;
  }

  async removeCartItem(userId: string, itemId: string): Promise<CartItem[]> {
    const user = await this.findByIdOrThrow(userId);
    const initialLength = user.cart.length;
    user.cart = user.cart.filter(
      (entry) => (entry as unknown as { _id: Types.ObjectId })._id.toString() !== itemId,
    ) as CartItem[];

    if (user.cart.length === initialLength) throw new CartItemNotFoundException(itemId);

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

  async addToWishlist(userId: string, productId: string): Promise<Types.ObjectId[]> {
    const user = await this.findByIdOrThrow(userId);
    const alreadyPresent = user.wishlist.some((id) => id.toString() === productId);
    if (!alreadyPresent) user.wishlist.push(new Types.ObjectId(productId));
    await user.save();
    return user.wishlist;
  }

  async removeFromWishlist(userId: string, productId: string): Promise<Types.ObjectId[]> {
    const user = await this.findByIdOrThrow(userId);
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();
    return user.wishlist;
  }
}
