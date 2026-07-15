import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShareReportDto {
  @ApiProperty({
    description: 'Optional property address to display on the shared preview',
    example: '123 Main St, New York, NY',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}
