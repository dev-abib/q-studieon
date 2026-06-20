import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Favorite Color', description: 'Category name' })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', description: 'Cloudinary icon URL for the category' })
  @IsString()
  @IsOptional()
  icon?: string;
}
