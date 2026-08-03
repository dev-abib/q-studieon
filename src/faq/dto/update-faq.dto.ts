import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFaqDto {
  @ApiPropertyOptional({
    example: 'How do I generate a report?',
    description: 'FAQ title',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'Open the Reports tab, tap "Generate", and follow the steps...',
    description: 'FAQ description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order (lower numbers appear first in the app)',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
