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

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
}

/**
 * The admin listing needs to show who placed each order. Orders only store `userId`, so
 * the customer's name/email are attached here from a batch lookup the service already
 * did — never a document from another module's schema, matching how `UserResponseDto`
 * takes a plain role shape rather than a `RoleDocument`.
 */
export class AdminOrderResponseDto extends OrderResponseDto {
  customer: OrderCustomer;

  static fromDocumentWithCustomer(
    order: OrderDocument,
    customer: OrderCustomer | null,
  ): AdminOrderResponseDto {
    const base = OrderResponseDto.fromDocument(order);
    const dto = new AdminOrderResponseDto();
    dto.id = base.id;
    dto.items = base.items;
    dto.total = base.total;
    dto.createdAt = base.createdAt;
    dto.customer = customer ?? {
      id: order.userId.toString(),
      name: 'Unknown customer',
      email: '—',
    };
    return dto;
  }
}
