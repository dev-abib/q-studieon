import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlagAction } from '@prisma/client';

export class FlagUserDto {
  @ApiProperty({
    description: 'Action requested to Super Admin',
    enum: FlagAction,
    example: 'BLOCK',
  })
  @IsEnum(FlagAction)
  @IsNotEmpty()
  action: FlagAction;

  @ApiProperty({
    description: 'Reason for flagging the user',
    example: 'Abusive support inquiries and spamming tickets',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional staff note or context for Super Admin review',
    example: 'User has opened 15 repetitive tickets in 2 hours',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
