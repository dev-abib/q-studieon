import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyDto {
  @IsString()
  @Length(4, 4)
  otp: string;

  @IsEmail()
  email: string;
}
