import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(201)
  checkout(@CurrentUser() user: RequestUser): Promise<OrderResponseDto> {
    return this.ordersService.checkout(user.userId);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getById(user.userId, id);
  }
}
