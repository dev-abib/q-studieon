import { IsOptional, IsString } from 'class-validator';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';

export class UpdateDynamicPageDto {
  @AtLeastOneField()
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  slug?: string;
}
