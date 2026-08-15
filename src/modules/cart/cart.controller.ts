import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestUser } from '../../common/types/authenticated-request';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: RequestUser): Promise<CartResponseDto> {
    return this.cartService.getCart(user.userId);
  }

  @Post()
  addItem(@CurrentUser() user: RequestUser, @Body() dto: AddToCartDto): Promise<CartResponseDto> {
    return this.cartService.addItem(user.userId, dto);
  }

  @Patch(':itemId')
  updateItem(
    @CurrentUser() user: RequestUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItem(user.userId, itemId, dto);
  }

  @Delete(':itemId')
  removeItem(@CurrentUser() user: RequestUser, @Param('itemId') itemId: string): Promise<CartResponseDto> {
    return this.cartService.removeItem(user.userId, itemId);
  }
}
