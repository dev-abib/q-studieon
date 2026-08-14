import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyContactQueryDto {
  @ApiProperty({
    example: 'Thank you for contacting us. We have activated your custom rate.',
    description: 'Admin response message sent to inquirer via email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Reply message is required' })
  @MinLength(5, { message: 'Reply must be at least 5 characters long' })
  @MaxLength(10000)
  replyMessage: string;

  @ApiPropertyOptional({
    example: 'Update regarding your inquiry on Enterprise Subscription',
    description: 'Custom subject for the email reply (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customSubject?: string;
}
