/**
 * Permissions are plain string keys rather than their own collection — they have no
 * attributes of their own, so a join table would add a layer without adding meaning.
 * This list is the single source of truth the admin UI renders checkboxes from.
 *
 * Every entry here must correspond to a real @RequirePermissions(...) check somewhere
 * in the code — a permission nothing enforces is dead weight that just confuses whoever
 * reads a role's permission list, so this list should never grow ahead of the guard
 * that gives it meaning.
 */
export const PERMISSIONS = {
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  PRODUCTS_DELETE: 'products:delete',
  CART_MANAGE: 'cart:manage',
  WISHLIST_MANAGE: 'wishlist:manage',
  ORDERS_CREATE: 'orders:create',
  /** View your own order history/detail — distinct from ORDERS_READ, which is "see every customer's orders". */
  ORDERS_READ_OWN: 'orders:read-own',
  ORDERS_READ: 'orders:read',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_ASSIGN_ROLE: 'users:assign-role',
  ROLES_MANAGE: 'roles:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** What a shopper needs to browse, cart, wishlist, checkout, and see their own orders. */
export const CUSTOMER_PERMISSIONS: Permission[] = [
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.CART_MANAGE,
  PERMISSIONS.WISHLIST_MANAGE,
  PERMISSIONS.ORDERS_CREATE,
  PERMISSIONS.ORDERS_READ_OWN,
];

export const ADMIN_ROLE_NAME = 'admin';
export const CUSTOMER_ROLE_NAME = 'customer';
