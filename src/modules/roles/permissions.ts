/**
 * Permissions are plain string keys rather than their own collection — they have no
 * attributes of their own, so a join table would add a layer without adding meaning.
 * This list is the single source of truth the admin UI renders checkboxes from.
 */
export const PERMISSIONS = {
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  PRODUCTS_DELETE: 'products:delete',
  ORDERS_READ: 'orders:read',
  USERS_READ: 'users:read',
  USERS_ASSIGN_ROLE: 'users:assign-role',
  ROLES_MANAGE: 'roles:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const ADMIN_ROLE_NAME = 'admin';
export const CUSTOMER_ROLE_NAME = 'customer';
