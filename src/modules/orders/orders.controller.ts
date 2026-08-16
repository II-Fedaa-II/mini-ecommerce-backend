import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PERMISSIONS } from '../roles/permissions';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import {
  AdminOrderResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * `Idempotency-Key` is optional but strongly recommended: send the same key when
   * retrying and the original order comes back instead of a second one being placed.
   */
  @Post()
  @HttpCode(201)
  checkout(
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.checkout(user.userId, idempotencyKey?.trim());
  }

  // Registered ahead of the `:id` route below — "me" would otherwise be swallowed as an id.
  @Get('me')
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    return this.ordersService.listMine(user.userId, query.page, query.limit);
  }

  // Every order across every customer, so it is gated on the same permission the other
  // admin-only reads use — a plain customer never reaches this even if they guess the URL.
  @Get()
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  listAll(
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedResponseDto<AdminOrderResponseDto>> {
    return this.ordersService.listForAdmin(
      query.search,
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getById(user.userId, id);
  }
}
