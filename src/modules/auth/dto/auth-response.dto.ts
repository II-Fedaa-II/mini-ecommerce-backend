import { UserDocument } from '../../users/schemas/user.schema';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  accessToken: string;
  user: UserResponseDto;

  static from(accessToken: string, user: UserDocument): AuthResponseDto {
    const dto = new AuthResponseDto();
    dto.accessToken = accessToken;
    dto.user = UserResponseDto.fromDocument(user);
    return dto;
  }
}
