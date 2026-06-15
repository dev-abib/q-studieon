import { IsOptional, IsString, IsEnum } from 'class-validator';
import { AnswerOption } from '@prisma/client';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateQuestionDto {
  @AtLeastOneField()
  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(AnswerOption, { each: true })
  @IsOptional()
  options?: AnswerOption[];
}
