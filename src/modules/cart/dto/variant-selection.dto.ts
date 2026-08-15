import { IsString } from 'class-validator';

export class VariantSelectionDto {
  @IsString()
  name: string;

  @IsString()
  value: string;
}
