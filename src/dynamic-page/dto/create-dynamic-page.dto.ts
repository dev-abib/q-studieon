import { IsString } from 'class-validator';
import { AtLeastOneField } from 'src/auth/decorators/at-least-one-filed.dto';

export class CreateDynamicPageDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  slug: string;
}
