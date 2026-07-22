import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateInsightDto {
  @AtLeastOneField()
  @ApiPropertyOptional({
    example: 'Property Insights',
    description: 'Insight title',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'Understand your property value',
    description: 'Insight subtitle',
  })
  @IsString()
  @IsOptional()
  subTitle?: string;

  @ApiPropertyOptional({
    example: 'Get detailed analysis of your property...',
    description: 'Insight description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: '/properties/analysis',
    description: 'Redirect link for the insight',
  })
  @IsString()
  @IsOptional()
  redirectLink?: string;
}
