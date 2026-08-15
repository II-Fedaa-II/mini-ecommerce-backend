import { UserDocument } from '../schemas/user.schema';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;

  static fromDocument(user: UserDocument): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user._id.toString();
    dto.email = user.email;
    dto.name = user.name;
    return dto;
  }
}
