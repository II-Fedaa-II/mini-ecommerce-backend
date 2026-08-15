import { Injectable } from '@nestjs/common';
import {
  EmptyCartException,
  InsufficientStockException,
  OrderNotFoundException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersRepository } from './repositories/orders.repository';
import { OrderLine } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async checkout(userId: string): Promise<OrderResponseDto> {
    const cartItems = await this.usersService.getCart(userId);
    if (cartItems.length === 0) throw new EmptyCartException();

    const productIds = [
      ...new Set(cartItems.map((item) => item.productId.toString())),
    ];
    const products = await this.productsService.findManyByIds(productIds);
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product]),
    );

    // Validate every line before mutating anything, so a single out-of-stock item
    // fails the whole checkout instead of leaving a partially-fulfilled order.
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

    const order = await this.ordersRepository.create({
      userId,
      items: orderLines,
      total,
    });

    await this.productsService.decrementManyStock(
      orderLines.map((line) => ({
        productId: line.productId.toString(),
        amount: line.quantity,
      })),
    );
    await this.usersService.clearCart(userId);

    return OrderResponseDto.fromDocument(order);
  }

  async getById(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order || order.userId.toString() !== userId)
      throw new OrderNotFoundException(orderId);
    return OrderResponseDto.fromDocument(order);
  }
}
