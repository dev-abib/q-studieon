import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ContactQueryPriority, ContactQueryStatus } from '@prisma/client';

export enum BulkQueryAction {
  ASSIGN = 'ASSIGN',
  UPDATE_STATUS = 'UPDATE_STATUS',
  UPDATE_PRIORITY = 'UPDATE_PRIORITY',
  DELETE = 'DELETE',
}

export class BulkActionContactQueriesDto {
  @ApiProperty({
    example: ['query-id-1', 'query-id-2'],
    description: 'Array of inquiry IDs to apply the bulk action to',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one inquiry ID is required' })
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({
    enum: BulkQueryAction,
    example: BulkQueryAction.ASSIGN,
    description: 'Action to perform across selected inquiries',
  })
  @IsEnum(BulkQueryAction)
  @IsNotEmpty()
  action: BulkQueryAction;

  @ApiPropertyOptional({
    example: 'user-cuid-123',
    description: 'Staff member ID when action is ASSIGN',
  })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({
    enum: ContactQueryStatus,
    description: 'Target status when action is UPDATE_STATUS',
  })
  @IsOptional()
  @IsEnum(ContactQueryStatus)
  status?: ContactQueryStatus;

  @ApiPropertyOptional({
    enum: ContactQueryPriority,
    description: 'Target priority when action is UPDATE_PRIORITY',
  })
  @IsOptional()
  @IsEnum(ContactQueryPriority)
  priority?: ContactQueryPriority;

  @ApiPropertyOptional({
    description: 'Optional transfer note when assigning',
  })
  @IsOptional()
  @IsString()
  transferNote?: string;
}
