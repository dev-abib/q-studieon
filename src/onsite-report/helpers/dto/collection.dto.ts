import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCollectionDto {
  @ApiProperty({
    description: 'Name of the collection',
    example: 'My Favorites',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Optional description for the collection',
    example: 'A collection of my top reports',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

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

export class RenameCollectionDto {
  @ApiProperty({
    description: 'New name for the collection',
    example: 'My Renamed Favorites',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class AddReportToCollectionDto {
  @ApiProperty({
    description: 'ID of the report to add to the collection',
    example: 'cmqr3abc123',
  })
  @IsString()
  @IsNotEmpty()
  reportId!: string;
}
