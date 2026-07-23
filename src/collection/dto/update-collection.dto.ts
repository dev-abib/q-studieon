import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCollectionDto {
  @ApiProperty({
    description: 'New name for the collection',
    example: 'My Updated Favorites',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Optional new description for the collection',
    example: 'An updated collection of my top reports',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
