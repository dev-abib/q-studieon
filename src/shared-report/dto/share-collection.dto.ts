import { ApiProperty } from '@nestjs/swagger';

export class ShareCollectionDto {
  @ApiProperty({
    description: 'Optional property address to display on the shared preview',
    example: '123 Main St, New York, NY',
    required: false,
  })
  address?: string;
}
