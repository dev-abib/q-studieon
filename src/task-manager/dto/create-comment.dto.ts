import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'I have started working on this module.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
