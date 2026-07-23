import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompareReportsDto {
  @ApiProperty({
    description: 'ID of the first report to compare',
    example: 'cmqr3abc123',
  })
  @IsString()
  @IsNotEmpty()
  reportId1!: string;

  @ApiProperty({
    description: 'ID of the second report to compare',
    example: 'cmqr3def456',
  })
  @IsString()
  @IsNotEmpty()
  reportId2!: string;
}
