import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FlagStatus } from '@prisma/client';

export class ResolveFlagDto {
  @ApiProperty({
    description: 'Decision status for the moderation flag',
    enum: FlagStatus,
    example: 'APPROVED',
  })
  @IsEnum(FlagStatus)
  @IsNotEmpty()
  status: FlagStatus;
}
