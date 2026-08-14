import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminDto {
  @ApiPropertyOptional({
    example: 'Updated Name',
    description: 'Admin display name (min 4 chars)',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  name?: string;
}
