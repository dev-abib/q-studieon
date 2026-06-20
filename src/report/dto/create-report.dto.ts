import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ example: '123 Main St, City, Country', description: 'Property address' })
  @IsString()
  address!: string;

  @ApiProperty({ example: 180.5, description: 'Entrance direction in degrees' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Type(() => Number)
  entranceDegrees!: number;

  @ApiProperty({ example: 40.7128, description: 'Latitude coordinate' })
  @IsNumber()
  @Type(() => Number)
  latitude!: number;

  @ApiProperty({ example: -74.006, description: 'Longitude coordinate' })
  @IsNumber()
  @Type(() => Number)
  longitude!: number;

  @ApiProperty({ example: 'Main Entrance', description: 'Label for the entrance' })
  @IsString()
  entranceLabel!: string;
}
