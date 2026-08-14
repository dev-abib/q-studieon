import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignContactQueryDto {
  @ApiProperty({
    example: 'user-cuid-123',
    description: 'User ID of the staff / admin member to assign this case to',
  })
  @IsString()
  @IsNotEmpty({ message: 'Staff member ID is required' })
  assignedToId: string;

  @ApiPropertyOptional({
    example: 'Transferred for billing verification',
    description: 'Internal transfer note or context for the assignee',
  })
  @IsOptional()
  @IsString()
  transferNote?: string;
}
