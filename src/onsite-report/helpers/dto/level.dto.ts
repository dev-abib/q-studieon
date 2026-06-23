import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ElementDto } from './element.dto';

export class LevelDto {
  @IsString()
  @IsNotEmpty()
  levelName!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  levelNumber?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ElementDto)
  elements!: ElementDto[];
}
