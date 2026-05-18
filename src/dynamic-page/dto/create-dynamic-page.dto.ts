import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateDynamicPageDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(1)
  description: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  slug: string;
}
