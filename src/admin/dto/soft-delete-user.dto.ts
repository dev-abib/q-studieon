import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SoftDeleteUserDto {
  @ApiPropertyOptional({
    description: 'Reason for deleting the user account',
    example: 'Requested by user due to account closure',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Whether to permanently purge immediately instead of 60-day soft delete retention (Super Admin only)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  immediateHardDelete?: boolean;
}
