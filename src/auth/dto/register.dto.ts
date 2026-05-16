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
import { Match } from '../decorators/match.decorator';

export class RegisterDto {
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber(undefined, {
    message:
      'Please provide a valid phone number with country code (e.g. +8801711000000)',
  })
  phoneNumber?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters, include uppercase, lowercase, number and special character',
  })
  password: string;

  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;

  @IsOptional()
  name: string;

  @IsBoolean()
  @Equals(true, { message: 'You must have to accept the terms and conditions' })
  termsAndConditions: boolean;

  @IsString()
  @IsOptional()
  guestId?: string;
}
