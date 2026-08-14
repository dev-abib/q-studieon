import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ContactQueryPriority } from '@prisma/client';

export class UpdateContactQueryPriorityDto {
  @ApiProperty({
    enum: ContactQueryPriority,
    example: ContactQueryPriority.HIGH,
    description: 'Priority level for the inquiry',
  })
  @IsEnum(ContactQueryPriority, {
    message: 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT',
  })
  @IsNotEmpty()
  priority: ContactQueryPriority;
}
