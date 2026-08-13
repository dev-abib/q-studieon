import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../auth/decorators/match.decorator';

export class AcceptInviteDto {
  @ApiProperty({
    example: 'abc123token',
    description: 'Invitation token from email link',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full display name',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'StrongP@ss1',
    description: 'Account password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters, include uppercase, lowercase, number and special character',
  })
  password: string;

  @ApiProperty({
    example: 'StrongP@ss1',
    description: 'Must match password field',
  })
  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;
}
