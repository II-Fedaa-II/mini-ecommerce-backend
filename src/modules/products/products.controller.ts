import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import {
  MissingImageException,
  UnsupportedImageTypeException,
} from '../../common/exceptions/domain.exceptions';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../roles/permissions';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Reads stay open to any signed-in shopper — the storefront needs them.
  @Get()
  list(
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    return this.productsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productsService.getById(id);
  }

  // Writes are permission-gated, so only roles the admin grants can reach them.
  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_WRITE)
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_WRITE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const { version, ...changes } = dto;
    return this.productsService.update(id, changes, version);
  }

  /**
   * Images are uploaded separately from the product body so the form can show a preview
   * before saving, and so a failed image upload never loses the typed fields.
   */
  @Post('upload')
  @RequirePermissions(PERMISSIONS.PRODUCTS_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, callback) => {
          // Never trust the client's filename on disk — keep only a safe extension.
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
        if (!allowed.includes(file.mimetype)) {
          callback(new UnsupportedImageTypeException(file.mimetype), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File): {
    imageUrl: string;
  } {
    if (!file) throw new MissingImageException();
    return { imageUrl: `/uploads/${file.filename}` };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_DELETE)
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.productsService.delete(id);
  }
}
