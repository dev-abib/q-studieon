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
import { Transform, plainToInstance } from 'class-transformer';
import { QuestionAnswerDto } from './qustion-answer.dto';

export class ElementDto {
  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed: unknown = JSON.parse(value);
      return plainToInstance(QuestionAnswerDto, parsed as object[]);
    }
    return plainToInstance(QuestionAnswerDto, value as object[]);
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
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
