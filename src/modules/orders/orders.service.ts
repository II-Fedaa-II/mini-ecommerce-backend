import { Injectable, Logger } from '@nestjs/common';
import {
  EmptyCartException,
  InsufficientStockException,
  OrderNotFoundException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { OrderResponseDto } from './dto/order-response.dto';
import {
  DUPLICATE_KEY_ERROR,
  OrdersRepository,
} from './repositories/orders.repository';
import { OrderLine } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async checkout(
    userId: string,
    idempotencyKey?: string,
  ): Promise<OrderResponseDto> {
    // A retried request (double-clicked button, flaky network) must return the original
    // order rather than charging the shopper twice.
    if (idempotencyKey) {
      const existing = await this.ordersRepository.findByIdempotencyKey(
        userId,
        idempotencyKey,
      );
      if (existing) return OrderResponseDto.fromDocument(existing);
    }

    const cartItems = await this.usersService.getCart(userId);
    if (cartItems.length === 0) throw new EmptyCartException();

    const productIds = [
      ...new Set(cartItems.map((item) => item.productId.toString())),
    ];
    const products = await this.productsService.findManyByIds(productIds);
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product]),
    );

    // Fail the whole checkout up front on an obviously short line, so the shopper gets a
    // precise message naming the product instead of a generic conflict.
    for (const item of cartItems) {
      const product = productMap.get(item.productId.toString());
      if (!product || product.stock < item.quantity) {
        throw new InsufficientStockException(
          item.productId.toString(),
          item.quantity,
          product?.stock ?? 0,
        );
      }
    }

    const orderLines: OrderLine[] = cartItems.map((item) => {
      const product = productMap.get(item.productId.toString())!;
      return {
        productId: product._id,
        title: product.title,
        price: product.price,
        quantity: item.quantity,
        selectedVariants: item.selectedVariants,
        subtotal: product.price * item.quantity,
      };
    });
    const total = orderLines.reduce((sum, line) => sum + line.subtotal, 0);

    const stockUpdates = orderLines.map((line) => ({
      productId: line.productId.toString(),
      amount: line.quantity,
    }));

    // Claim the stock first, conditionally. The check above can go stale between reading
    // and writing, so the decrement itself is the real guard against overselling.
    const claimed = await this.productsService.decrementManyStock(stockUpdates);
    if (claimed.length !== stockUpdates.length) {
      // Give back only what this request actually took. Lines that never applied were
      // never ours to return — restoring them would create stock that does not exist.
      await this.productsService.restoreManyStock(claimed);

      const lost = stockUpdates.find(
        (update) => !claimed.some((c) => c.productId === update.productId),
      )!;
      throw new InsufficientStockException(lost.productId, lost.amount, 0);
    }

    try {
      const order = await this.ordersRepository.create({
        userId,
        items: orderLines,
        total,
        idempotencyKey,
      });
      await this.usersService.clearCart(userId);
      return OrderResponseDto.fromDocument(order);
    } catch (error) {
      // The order did not persist, so the stock this request claimed must go back.
      // Exactly once, on every failure path.
      await this.productsService.restoreManyStock(claimed);

      // Two requests carrying the same key raced past the lookup above and the unique
      // index rejected this one. The winner's order is the correct answer to return.
      if (this.isDuplicateKeyError(error) && idempotencyKey) {
        const winner = await this.ordersRepository.findByIdempotencyKey(
          userId,
          idempotencyKey,
        );
        if (winner) return OrderResponseDto.fromDocument(winner);
      }

      this.logger.error('Checkout failed after stock was claimed', error);
      throw error;
    }
  }

  async getById(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order || order.userId.toString() !== userId)
      throw new OrderNotFoundException(orderId);
    return OrderResponseDto.fromDocument(order);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === DUPLICATE_KEY_ERROR
    );
  }
}
