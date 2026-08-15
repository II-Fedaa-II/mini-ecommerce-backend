import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UserDocument } from '../../users/schemas/user.schema';

export class AuthResponseDto {
  accessToken: string;
  user: UserResponseDto;

  /**
   * The role travels with the login response so a client can gate its own navigation
   * without a second round trip. It is a convenience for the UI only — every endpoint
   * still re-checks permissions server-side on each request.
   */
  static from(
    accessToken: string,
    user: UserDocument,
    role: { id: string; name: string; permissions: string[] } | null,
  ): AuthResponseDto {
    const dto = new AuthResponseDto();
    dto.accessToken = accessToken;
    dto.user = UserResponseDto.fromDocument(user, role);
    return dto;
  }
}
