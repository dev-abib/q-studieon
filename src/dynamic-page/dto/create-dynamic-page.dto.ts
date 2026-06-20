import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDynamicPageDto {
  @ApiProperty({ example: 'About Us', description: 'Page title' })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({ example: 'This is the about us page content...', description: 'Page description/content' })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(1)
  description: string;

  @ApiProperty({ example: 'about-us', description: 'URL slug for the page' })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  slug: string;
}
