import { IsEmail, IsString } from 'class-validator';

export class AdminMailDto {
  @IsEmail()
  @IsString()
  email: string;

  @IsString()
  message: string;

  @IsString()
  subject: string;
}
