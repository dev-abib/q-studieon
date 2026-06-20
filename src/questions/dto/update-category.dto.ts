import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateCategoryDto {
  @AtLeastOneField()
  @ApiPropertyOptional({ example: 'Favorite Color', description: 'Category name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', description: 'Cloudinary icon URL for the category' })
  @IsString()
  @IsOptional()
  icon?: string;
}
