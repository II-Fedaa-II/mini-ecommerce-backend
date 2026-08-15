import { OrderDocument } from '../schemas/order.schema';

export class OrderLineDto {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  selectedVariants: { name: string; value: string }[];
  subtotal: number;
}

export class OrderResponseDto {
  id: string;
  items: OrderLineDto[];
  total: number;
  createdAt: Date;

  static fromDocument(order: OrderDocument): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order._id.toString();
    dto.total = order.total;
    dto.createdAt = order.get('createdAt') as Date;
    dto.items = order.items.map((line) => ({
      productId: line.productId.toString(),
      title: line.title,
      price: line.price,
      quantity: line.quantity,
      selectedVariants: line.selectedVariants,
      subtotal: line.subtotal,
    }));
    return dto;
  }
}
