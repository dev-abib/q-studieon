import { IsEmail, IsNumberString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyAccountDto {
  @ApiProperty({ example: '1234', description: '4-digit OTP code', minLength: 4, maxLength: 4 })
  @IsNumberString()
  @Length(4, 4)
  otp: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email address to verify' })
  @IsEmail()
  email: string;
}
