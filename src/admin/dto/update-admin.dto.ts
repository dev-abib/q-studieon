import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateAdminDto {
  @AtLeastOneField()
  @ApiPropertyOptional({ example: 'Updated Name', description: 'Admin display name (min 4 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  name?: string;

  @ApiPropertyOptional({ example: 'newemail@example.com', description: 'Admin email address' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
