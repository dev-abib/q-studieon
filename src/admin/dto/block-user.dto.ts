import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockUserDto {
  @ApiProperty({
    description: 'The date and time until which the user is blocked (ISO string)',
    example: '2026-08-21T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  blockedUntil: string;

  @ApiPropertyOptional({
    description: 'The reason or note for soft blocking the account',
    example: 'Suspicious scraping activity detected',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
