import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFaqDto {
  @ApiProperty({
    example: 'How do I generate a report?',
    description: 'FAQ title',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @ApiProperty({
    example: 'Open the Reports tab, tap "Generate", and follow the steps...',
    description: 'FAQ description',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description!: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order (lower numbers appear first in the app)',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
