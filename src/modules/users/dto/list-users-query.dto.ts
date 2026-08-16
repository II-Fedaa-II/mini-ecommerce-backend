import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  /** Matches against name or email, case-insensitive. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsMongoId()
  roleId?: string;
}
