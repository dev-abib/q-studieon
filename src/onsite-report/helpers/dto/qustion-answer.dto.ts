import { IsNotEmpty, IsString } from 'class-validator';

export class QuestionAnswerDto {
  @IsString()
  question!: string;

  @IsString()
  @IsNotEmpty()
  selectedOption!: string;
}
