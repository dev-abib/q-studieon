import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CollectionTypeEnum {
  remote = 'remote',
  onsite = 'onsite',
}

export class CreateCollectionDto {
  @ApiProperty({
    description: 'Name of the collection',
    example: 'My Favorites',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Type of collection — remote or onsite',
    enum: CollectionTypeEnum,
    example: 'remote',
    default: 'remote',
  })
  @IsEnum(CollectionTypeEnum)
  @IsNotEmpty()
  type!: CollectionTypeEnum;

  @ApiProperty({
    description: 'Optional description for the collection',
    example: 'A collection of my top reports',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
