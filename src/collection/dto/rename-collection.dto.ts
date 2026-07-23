import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameCollectionDto {
  @ApiProperty({
    description: 'New name for the collection',
    example: 'My Renamed Favorites',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
