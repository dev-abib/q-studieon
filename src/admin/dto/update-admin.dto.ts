import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateAdminDto {
  @AtLeastOneField()
  @IsOptional()
  @IsString()
  @MinLength(4)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
