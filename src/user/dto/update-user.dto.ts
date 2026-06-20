import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateUserDto {
  @AtLeastOneField()
  @ApiPropertyOptional({ example: 'John Doe', description: 'User display name (min 4 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  name?: string;

  @ApiPropertyOptional({ example: 'newemail@example.com', description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
