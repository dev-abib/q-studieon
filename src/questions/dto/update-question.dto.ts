import { IsOptional, IsString, IsArray } from 'class-validator';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateQuestionDto {
  @AtLeastOneField()
  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsArray()
  @IsString({ each: true, message: 'Each option must be a string' })
  @IsOptional()
  options?: string[];
}
