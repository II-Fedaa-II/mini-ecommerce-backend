import { Injectable } from '@nestjs/common';
import {
  ProductNotFoundException,
  ProductTitleTakenException,
} from '../../common/exceptions/domain.exceptions';
import { ProductResponseDto } from './dto/product-response.dto';
import {
  CreateProductData,
  ProductsRepository,
  StockUpdate,
} from './repositories/products.repository';
import { ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productsRepository.findAll();
    return products.map((product) => ProductResponseDto.fromDocument(product));
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

  /** Returns the lines that were actually claimed — fewer means someone else took stock. */
  decrementManyStock(updates: StockUpdate[]): Promise<StockUpdate[]> {
    return this.productsRepository.decrementManyStock(updates);
  }

  async restoreManyStock(updates: StockUpdate[]): Promise<void> {
    await this.productsRepository.restoreManyStock(updates);
  }

  count(): Promise<number> {
    return this.productsRepository.count();
  }

  async create(data: CreateProductData): Promise<ProductResponseDto> {
    await this.assertTitleIsFree(data.title);
    const product = await this.productsRepository.create(data);
    return ProductResponseDto.fromDocument(product);
  }

  async update(
    id: string,
    data: Partial<CreateProductData>,
  ): Promise<ProductResponseDto> {
    if (data.title) await this.assertTitleIsFree(data.title, id);

    const product = await this.productsRepository.update(id, data);
    if (!product) throw new ProductNotFoundException(id);
    return ProductResponseDto.fromDocument(product);
  }

  /**
   * There is no SKU in this data model, so the title is the only thing distinguishing
   * one product from another — two identically titled products would be indistinguishable
   * to a shopper. `exceptId` lets an edit keep its own title.
   */
  private async assertTitleIsFree(
    title: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.productsRepository.findByTitle(title.trim());
    if (existing && existing._id.toString() !== exceptId) {
      throw new ProductTitleTakenException(title);
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.productsRepository.delete(id);
    if (!deleted) throw new ProductNotFoundException(id);
  }

  async createMany(data: CreateProductData[]): Promise<void> {
    await this.productsRepository.createMany(data);
  }
}
