import { Injectable } from '@nestjs/common';
import { ProductResponseDto } from '../products/dto/product-response.dto';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class WishlistService {
  constructor(
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
  ) {}

  async getWishlist(userId: string): Promise<ProductResponseDto[]> {
    const productIds = await this.usersService.getWishlist(userId);
    if (productIds.length === 0) return [];

    // Single batched lookup for the whole wishlist — never N+1 per product id.
    const products = await this.productsService.findManyByIds(
      productIds.map((id) => id.toString()),
    );
    return products.map((product) => ProductResponseDto.fromDocument(product));
  }

  async addItem(
    userId: string,
    productId: string,
  ): Promise<ProductResponseDto[]> {
    await this.productsService.findDocumentOrThrow(productId);
    await this.usersService.addToWishlist(userId, productId);
    return this.getWishlist(userId);
  }

  async removeItem(
    userId: string,
    productId: string,
  ): Promise<ProductResponseDto[]> {
    await this.usersService.removeFromWishlist(userId, productId);
    return this.getWishlist(userId);
  }
}
