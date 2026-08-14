import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleDeletePermissionDto {
  @ApiProperty({
    description: 'Whether the staff member is permitted to delete inquiries',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  canDelete: boolean;
}
