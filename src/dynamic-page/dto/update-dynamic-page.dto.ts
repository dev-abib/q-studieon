import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateDynamicPageDto {
  @AtLeastOneField()
  @ApiPropertyOptional({ example: 'Updated Title', description: 'Page title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description...', description: 'Page description/content' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'updated-about-us', description: 'URL slug' })
  @IsString()
  @IsOptional()
  slug?: string;
}
