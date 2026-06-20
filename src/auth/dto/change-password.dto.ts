import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../decorators/match.decorator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldP@ss1',
    description: 'Current password',
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
  oldPassword: string;

  @ApiProperty({
    example: 'NewStrongP@ss1',
    description: 'New password',
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

  @ApiProperty({ example: 'NewStrongP@ss1', description: 'Must match the new password' })
  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;
}
