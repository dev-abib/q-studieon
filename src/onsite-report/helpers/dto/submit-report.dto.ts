import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LevelDto } from './level.dto';

export class SubmitOnsiteReportDto {
  @IsString()
  @IsNotEmpty()
  address!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  latitude!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  longitude!: number;

  @Transform(({ value }) => {
    const parsed: unknown =
      typeof value === 'string' ? JSON.parse(value) : value;
    return parsed as LevelDto[];
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LevelDto)
  levels!: LevelDto[];
}
