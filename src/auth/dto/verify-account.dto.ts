import { IsEmail, IsNumberString, Length } from 'class-validator';

export class VerifyAccountDto {
  @IsNumberString()
  @Length(4, 4)
  otp: string;

  @IsEmail()
  email: string;
}
