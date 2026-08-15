import { Injectable } from '@nestjs/common';
import { ProductNotFoundException } from '../../common/exceptions/domain.exceptions';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductsRepository } from './repositories/products.repository';
import { ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productsRepository.findAll();
    return products.map(ProductResponseDto.fromDocument);
  }

  async getById(id: string): Promise<ProductResponseDto> {
    const product = await this.findDocumentOrThrow(id);
    return ProductResponseDto.fromDocument(product);
  }

  async findDocumentOrThrow(id: string): Promise<ProductDocument> {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new ProductNotFoundException(id);
    return product;
  }

  /** Single batched lookup for N line items — never call findDocumentOrThrow in a loop. */
  async findManyByIds(ids: string[]): Promise<ProductDocument[]> {
    return this.productsRepository.findByIds(ids);
  }

  async decrementStock(id: string, amount: number): Promise<void> {
    await this.productsRepository.decrementStock(id, amount);
  }

  async decrementManyStock(updates: { productId: string; amount: number }[]): Promise<void> {
    await this.productsRepository.decrementManyStock(updates);
  }
}
