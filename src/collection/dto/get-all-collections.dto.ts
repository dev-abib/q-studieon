import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CollectionTypeEnum } from './create-collection.dto';

export class GetAllCollectionsDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filter by collection type (remote or onsite). When set, both ' +
      'collections and recentReports are filtered to match the type.',
    enum: CollectionTypeEnum,
    example: 'remote',
  })
  @IsOptional()
  @IsEnum(CollectionTypeEnum)
  type?: CollectionTypeEnum;
}
