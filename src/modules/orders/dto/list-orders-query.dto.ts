import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListOrdersQueryDto extends PaginationQueryDto {
  /** Matched against customer email — orders have no searchable fields of their own. */
  @IsOptional()
  @IsString()
  search?: string;
}
