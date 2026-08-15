import { Injectable } from '@nestjs/common';
import {
  CartItemNotFoundException,
  InsufficientStockException,
  InvalidVariantSelectionException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { ProductDocument } from '../products/schemas/product.schema';
import { CartItem } from '../users/schemas/cart-item.schema';
import { UsersService } from '../users/users.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { CartLineDto, CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
  ) {}

  async getCart(userId: string): Promise<CartResponseDto> {
    const items = await this.usersService.getCart(userId);
    return this.buildResponse(items);
  }

  async addItem(userId: string, dto: AddToCartDto): Promise<CartResponseDto> {
    const product = await this.productsService.findDocumentOrThrow(
      dto.productId,
    );
    const selectedVariants = dto.selectedVariants ?? [];
    this.assertVariantsValid(product, selectedVariants);
    this.assertStock(product, dto.quantity);

    const items = await this.usersService.addCartItem(
      userId,
      dto.productId,
      dto.quantity,
      selectedVariants,
    );
    return this.buildResponse(items);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    if (dto.quantity !== undefined) {
      const current = await this.usersService.getCart(userId);
      const item = this.findItem(current, itemId);
      const product = await this.productsService.findDocumentOrThrow(
        item.productId.toString(),
      );
      this.assertStock(product, dto.quantity);
    }

    const items = await this.usersService.updateCartItem(userId, itemId, dto);
    return this.buildResponse(items);
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponseDto> {
    const items = await this.usersService.removeCartItem(userId, itemId);
    return this.buildResponse(items);
  }

  private findItem(items: CartItem[], itemId: string): CartItem {
    const item = items.find(
      (entry) =>
        (entry as unknown as { _id: { toString(): string } })._id.toString() ===
        itemId,
    );
    if (!item) throw new CartItemNotFoundException(itemId);
    return item;
  }

  private assertVariantsValid(
    product: ProductDocument,
    selected: { name: string; value: string }[],
  ): void {
    for (const selection of selected) {
      const variant = product.variants.find((v) => v.name === selection.name);
      if (!variant || !variant.options.includes(selection.value)) {
        throw new InvalidVariantSelectionException(
          selection.name,
          selection.value,
        );
      }
    }
  }

  private assertStock(product: ProductDocument, quantity: number): void {
    if (product.stock < quantity) {
      throw new InsufficientStockException(
        product._id.toString(),
        quantity,
        product.stock,
      );
    }
  }

  /** One batched product lookup for the whole cart — never N+1 per line item. */
  private async buildResponse(items: CartItem[]): Promise<CartResponseDto> {
    const productIds = [
      ...new Set(items.map((item) => item.productId.toString())),
    ];
    const products = await this.productsService.findManyByIds(productIds);
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product]),
    );

    const lines = items.map((item) =>
      CartLineDto.from(item, productMap.get(item.productId.toString())),
    );
    return CartResponseDto.from(lines);
  }
}
