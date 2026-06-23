import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { QuestionAnswerDto } from './qustion-answer.dto';

export class ElementDto {
  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed: unknown = JSON.parse(value);
      return parsed as QuestionAnswerDto[];
    }
    return value as QuestionAnswerDto[];
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  answers!: QuestionAnswerDto[];

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(359)
  bearingDegrees!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
