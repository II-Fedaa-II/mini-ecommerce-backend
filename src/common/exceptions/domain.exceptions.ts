import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super(`User ${userId} was not found`);
  }
}

export class ProductNotFoundException extends NotFoundException {
  constructor(productId: string) {
    super(`Product ${productId} was not found`);
  }
}

export class ProductTitleTakenException extends ConflictException {
  constructor(title: string) {
    super(`A product titled "${title}" already exists`);
  }
}

export class InsufficientStockException extends ConflictException {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Only ${available} unit(s) of product ${productId} are available (requested ${requested})`,
    );
  }
}

export class CartItemNotFoundException extends NotFoundException {
  constructor(itemId: string) {
    super(`Cart item ${itemId} was not found`);
  }
}

export class WishlistItemNotFoundException extends NotFoundException {
  constructor(productId: string) {
    super(`Product ${productId} was not found in the wishlist`);
  }
}

export class InvalidVariantSelectionException extends BadRequestException {
  constructor(name: string, value: string) {
    super(`Invalid variant selection: ${name}=${value}`);
  }
}

export class EmptyCartException extends ConflictException {
  constructor() {
    super('Cannot check out an empty cart');
  }
}

export class OrderNotFoundException extends NotFoundException {
  constructor(orderId: string) {
    super(`Order ${orderId} was not found`);
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid email or password');
  }
}

export class RefreshTokenReuseException extends UnauthorizedException {
  constructor() {
    super(
      'Refresh token reuse detected — all sessions for this account have been revoked',
    );
  }
}

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('Refresh token is invalid or expired');
  }
}

export class InsufficientPermissionsException extends ForbiddenException {
  constructor(permission: string) {
    super(`Missing required permission: ${permission}`);
  }
}

export class RoleNotFoundException extends NotFoundException {
  constructor(roleId: string) {
    super(`Role ${roleId} was not found`);
  }
}

export class RoleInUseException extends ConflictException {
  constructor(roleName: string) {
    super(
      `Role ${roleName} is still assigned to at least one user and cannot be deleted`,
    );
  }
}

export class RoleNameTakenException extends ConflictException {
  constructor(roleName: string) {
    super(`A role named "${roleName}" already exists`);
  }
}

export class SystemRoleImmutableException extends ForbiddenException {
  constructor(roleName: string) {
    super(`The built-in "${roleName}" role cannot be modified or deleted`);
  }
}

export class UnknownPermissionException extends BadRequestException {
  constructor(permission: string) {
    super(`Unknown permission: ${permission}`);
  }
}
