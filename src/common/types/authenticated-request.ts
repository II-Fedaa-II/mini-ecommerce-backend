import { Request } from 'express';

export interface RequestUser {
  userId: string;
  email: string;
  roleName: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
