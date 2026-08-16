import { Injectable, Logger } from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import {
  EmptyCartException,
  InsufficientStockException,
  OrderNotFoundException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import {
  AdminOrderResponseDto,
  OrderCustomer,
  OrderResponseDto,
} from './dto/order-response.dto';
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

  async listMine(
    userId: string,
    page: number,
    limit: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const { items, total } = await this.ordersRepository.findPage({
      userId,
      page,
      limit,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
    return PaginatedResponseDto.create(
      items.map((order) => OrderResponseDto.fromDocument(order)),
      total,
      page,
      limit,
    );
  }

  /**
   * There is no full-text order search — "search" means "find this customer's orders",
   * resolved as a separate lookup rather than a join. An empty match short-circuits
   * before the order query: `userId: { $in: [] }` would also return nothing, but running
   * it would be a wasted round trip for a search the caller already knows matched no one.
   */
  async listForAdmin(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<AdminOrderResponseDto>> {
    let userIds: string[] | undefined;

    if (search?.trim()) {
      const matchedUsers = await this.usersService.searchByEmail(search.trim());
      if (matchedUsers.length === 0) {
        return PaginatedResponseDto.create([], 0, page, limit);
      }
      userIds = matchedUsers.map((user) => user._id.toString());
    }

    const { items, total } = await this.ordersRepository.findPage({
      userIds,
      page,
      limit,
    });

    // Batched, not per-order: one lookup for the whole page regardless of how many
    // distinct customers appear on it.
    const distinctCustomerIds = [
      ...new Set(items.map((order) => order.userId.toString())),
    ];
    const customers = await this.usersService.findByIds(distinctCustomerIds);
    const customerMap = new Map<string, OrderCustomer>(
      customers.map((customer) => [
        customer._id.toString(),
        {
          id: customer._id.toString(),
          name: customer.name,
          email: customer.email,
        },
      ]),
    );

    const dtos = items.map((order) =>
      AdminOrderResponseDto.fromDocumentWithCustomer(
        order,
        customerMap.get(order.userId.toString()) ?? null,
      ),
    );

    return PaginatedResponseDto.create(dtos, total, page, limit);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === DUPLICATE_KEY_ERROR
    );
  }
}
