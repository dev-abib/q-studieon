import { IsString, IsNotEmpty, IsArray, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({ example: 'What is your favorite color?', description: 'Question text' })
  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  @MinLength(1)
  text: string;

  @ApiPropertyOptional({ example: 'favorite-color', description: 'Unique slug for the question' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ example: ['Red', 'Blue', 'Green'], description: 'List of answer options', isArray: true })
  @IsArray()
  @IsString({ each: true, message: 'Each option must be a string' })
  @IsNotEmpty({ message: 'Options are required' })
  options: string[];
}
