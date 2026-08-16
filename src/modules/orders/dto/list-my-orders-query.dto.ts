import { IsDateString, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListMyOrdersQueryDto extends PaginationQueryDto {
  /** Inclusive — orders placed on this date or later. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Inclusive — orders placed on this date or earlier. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
