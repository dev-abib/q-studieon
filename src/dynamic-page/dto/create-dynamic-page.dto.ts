import { IsString } from 'class-validator';

export class CreateDynamicPageDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  slug: string;
}
