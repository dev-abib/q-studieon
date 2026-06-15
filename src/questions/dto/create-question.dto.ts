import { IsString, IsNotEmpty, IsEnum, MinLength } from 'class-validator';
import { AnswerOption } from '@prisma/client';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  @MinLength(1)
  text: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  slug: string;

  @IsEnum(AnswerOption, { each: true, message: 'Invalid answer option' })
  @IsNotEmpty({ message: 'Options are required' })
  options: AnswerOption[];
}
