import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Match } from '../../auth/decorators/match.decorator';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Admin email address' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'StrongP@ss1',
    description: 'Password must be at least 8 chars, include uppercase, lowercase, number and special character',
    minLength: 8,
    maxLength: 32,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters, include uppercase, lowercase, number and special character',
  })
  password: string;

  @ApiProperty({ example: 'StrongP@ss1', description: 'Must match the password field' })
  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;

  @ApiPropertyOptional({ example: 'Admin User', description: 'Admin display name' })
  @IsOptional()
  name: string;

  @ApiPropertyOptional({ example: 'guest_abc123', description: 'Guest ID if converting from guest' })
  @IsString()
  @IsOptional()
  guestId?: string;
}
