import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  /**
   * The version the editor loaded. Required for field edits so a concurrent change is
   * detected; omitted only for internal updates that do not originate from a form.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
