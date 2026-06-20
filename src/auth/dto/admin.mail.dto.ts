import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminMailDto {
  @ApiProperty({ example: 'user@example.com', description: 'Recipient email address' })
  @IsEmail()
  @IsString()
  email: string;

  @ApiProperty({ example: 'Hello, this is an important message...', description: 'Email body content' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'Important Announcement', description: 'Email subject line' })
  @IsString()
  subject: string;
}
