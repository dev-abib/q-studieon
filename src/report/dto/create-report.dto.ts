import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  address!: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Type(() => Number)
  entranceDegrees!: number;

  @IsNumber()
  @Type(() => Number)
  latitude!: number;

  @IsNumber()
  @Type(() => Number)
  longitude!: number;

  @IsString()
  entranceLabel!: string;
}
