import { Type } from 'class-transformer';
import {  IsNumber, IsString } from 'class-validator';

export class AddressDto {
  @IsString()
  address!: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Type(() => Number)
  entranceDegrees!: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Type(() => Number)
  latitude!: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Type(() => Number)
  longitude!: number;

  @IsString()
  entranceLabel!: string;
}
