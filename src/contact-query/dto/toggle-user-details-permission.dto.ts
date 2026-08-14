import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleUserDetailsPermissionDto {
  @ApiProperty({
    description: 'Whether the staff member is permitted to view user details',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  canViewUserDetails: boolean;
}
