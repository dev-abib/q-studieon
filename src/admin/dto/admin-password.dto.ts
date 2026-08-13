import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../auth/decorators/match.decorator';

export class AdminForgotPasswordDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Admin email address to send password reset link',
  })
  @IsEmail()
  email: string;
}

export class AdminResetPasswordDto {
  @ApiProperty({
    example: 'token_abc123',
    description: 'Password reset token from email link',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NewStrongP@ss1',
    description: 'New password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters, include uppercase, lowercase, number and special character',
  })
  newPassword: string;

  @ApiProperty({
    example: 'NewStrongP@ss1',
    description: 'Must match newPassword field',
  })
  @IsString()
  @Match('newPassword', { message: 'Passwords do not match' })
  confirmPassword: string;
}
