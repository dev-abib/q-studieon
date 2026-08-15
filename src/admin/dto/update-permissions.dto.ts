import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePermissionsDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canDeleteQueries?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canViewUserDetails?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canChangePassword?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canManageFaqs?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canManagePages?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canManageTasks?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canManagePayments?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  canManageReports?: boolean;
}
