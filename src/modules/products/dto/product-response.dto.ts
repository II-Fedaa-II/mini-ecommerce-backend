import { ProductDocument } from '../schemas/product.schema';

export class ProductVariantDto {
  name: string;
  options: string[];
}

export class ProductResponseDto {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  variants: ProductVariantDto[];

  static fromDocument(product: ProductDocument): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product._id.toString();
    dto.title = product.title;
    dto.description = product.description;
    dto.price = product.price;
    dto.stock = product.stock;
    dto.variants = product.variants.map((variant) => ({ name: variant.name, options: variant.options }));
    return dto;
  }
}
