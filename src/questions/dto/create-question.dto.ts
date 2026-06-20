import { IsString, IsNotEmpty, IsArray, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({ example: 'What is your favorite color?', description: 'Question text' })
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  @MinLength(1)
  text: string;

  @ApiProperty({ example: ['Red', 'Blue', 'Green'], description: 'List of answer options', isArray: true })
  @IsArray()
  @IsString({ each: true, message: 'Each option must be a string' })
  @IsNotEmpty({ message: 'Options are required' })
  options: string[];

  @ApiProperty({ example: 'category-id-here', description: 'Category ID the question belongs to' })
  @IsString()
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId: string;
}
