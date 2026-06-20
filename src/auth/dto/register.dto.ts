import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  Matches,
  IsBoolean,
  Equals,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Match } from '../decorators/match.decorator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email address (optional if phone provided)' })
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+8801711000000', description: 'Phone number with country code (optional if email provided)' })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message:
      'Please provide a valid phone number with country code (e.g. +8801711000000)',
  })
  phoneNumber?: string;

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

  @ApiPropertyOptional({ example: 'John Doe', description: 'User display name' })
  @IsOptional()
  name: string;

  @ApiProperty({ example: true, description: 'Must accept terms and conditions' })
  @IsBoolean()
  @Equals(true, { message: 'You must have to accept the terms and conditions' })
  termsAndConditions: boolean;

  @ApiPropertyOptional({ example: 'guest_abc123', description: 'Guest ID if converting from guest account' })
  @IsString()
  @IsOptional()
  guestId?: string;
}
