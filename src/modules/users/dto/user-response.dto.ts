import { UserDocument } from '../schemas/user.schema';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: { id: string; name: string; permissions: string[] } | null;

  /**
   * `passwordHash` is `select: false` on the schema and is never copied here, so a
   * credential can't leak through a response even if a query opts it back in.
   */
  static fromDocument(
    user: UserDocument,
    role?: { id: string; name: string; permissions: string[] } | null,
  ): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user._id.toString();
    dto.email = user.email;
    dto.name = user.name;
    dto.role = role ?? null;
    return dto;
  }
}
