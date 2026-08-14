import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddInternalNoteDto {
  @ApiProperty({
    example: 'Spoke with customer over phone, agreed on custom enterprise discount.',
    description: 'Internal team note content',
  })
  @IsString()
  @IsNotEmpty({ message: 'Internal note cannot be empty' })
  note: string;
}
