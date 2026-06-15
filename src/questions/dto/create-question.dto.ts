import { IsString, IsNotEmpty, IsArray, MinLength } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  @MinLength(1)
  text: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  slug: string;

  @IsArray()
  @IsString({ each: true, message: 'Each option must be a string' })
  @IsNotEmpty({ message: 'Options are required' })
  options: string[];
}
