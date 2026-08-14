import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ContactQueryStatus } from '@prisma/client';

export class UpdateContactQueryStatusDto {
  @ApiProperty({
    enum: ContactQueryStatus,
    example: ContactQueryStatus.RESOLVED,
    description: 'Updated inquiry status',
  })
  @IsEnum(ContactQueryStatus)
  @IsNotEmpty()
  status: ContactQueryStatus;
}
