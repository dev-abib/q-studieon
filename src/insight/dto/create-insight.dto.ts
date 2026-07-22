import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInsightDto {
  @ApiProperty({ example: 'Property Insights', description: 'Insight title' })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @ApiProperty({
    example: 'Understand your property value',
    description: 'Insight subtitle',
  })
  @IsString()
  @IsNotEmpty({ message: 'Subtitle is required' })
  subTitle!: string;

  @ApiProperty({
    example: 'Get detailed analysis of your property...',
    description: 'Insight description',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description!: string;

  @ApiPropertyOptional({
    example: '/properties/analysis',
    description: 'Redirect link for the insight',
  })
  @IsString()
  @IsOptional()
  redirectLink?: string;
}
