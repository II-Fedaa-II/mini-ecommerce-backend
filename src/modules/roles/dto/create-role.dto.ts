import {
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'name must be lowercase letters, numbers, or hyphens',
  })
  name: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];
}
