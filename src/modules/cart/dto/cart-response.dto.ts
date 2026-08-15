import { ProductDocument } from '../../products/schemas/product.schema';
import { CartItem } from '../../users/schemas/cart-item.schema';

export class CartLineDto {
  itemId: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  selectedVariants: { name: string; value: string }[];
  subtotal: number;

  static from(item: CartItem, product: ProductDocument | undefined): CartLineDto {
    const dto = new CartLineDto();
    dto.itemId = (item as unknown as { _id: { toString(): string } })._id.toString();
    dto.productId = item.productId.toString();
    dto.title = product?.title ?? 'Unknown product';
    dto.price = product?.price ?? 0;
    dto.quantity = item.quantity;
    dto.selectedVariants = item.selectedVariants.map((v) => ({ name: v.name, value: v.value }));
    dto.subtotal = dto.price * item.quantity;
    return dto;
  }
}

export class CartResponseDto {
  items: CartLineDto[];
  total: number;

  static from(lines: CartLineDto[]): CartResponseDto {
    const dto = new CartResponseDto();
    dto.items = lines;
    dto.total = lines.reduce((sum, line) => sum + line.subtotal, 0);
    return dto;
  }
}
