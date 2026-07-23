import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddReportToCollectionDto {
  @ApiProperty({
    description: 'ID of the report to add to the collection',
    example: 'cmqr3abc123',
  })
  @IsString()
  @IsNotEmpty()
  reportId!: string;
}
