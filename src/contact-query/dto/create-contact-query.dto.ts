import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactQueryDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the person submitting inquiry',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the sender',
  })
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'Question about Enterprise Subscription',
    description: 'Subject of the inquiry',
  })
  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    example: 'I would like to inquire about volume pricing for 50 inspectors.',
    description: 'Message details',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MinLength(5, { message: 'Message must be at least 5 characters long' })
  @MaxLength(5000)
  message: string;
}
