import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PERMISSIONS } from '../roles/permissions';
import { ProductResponseDto } from '../products/dto/product-response.dto';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.WISHLIST_MANAGE)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@CurrentUser() user: RequestUser): Promise<ProductResponseDto[]> {
    return this.wishlistService.getWishlist(user.userId);
  }

  @Post(':productId')
  addItem(
    @CurrentUser() user: RequestUser,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto[]> {
    return this.wishlistService.addItem(user.userId, productId);
  }

  @Delete(':productId')
  removeItem(
    @CurrentUser() user: RequestUser,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto[]> {
    return this.wishlistService.removeItem(user.userId, productId);
  }
}
