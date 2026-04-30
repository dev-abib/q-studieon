import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsInt,
  MaxLength,
  Matches,
  isEnum,
  IsBoolean,
  Equals,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must be at least 8 characters, include uppercase, lowercase, number and special character',
    },
  )
  password: string;

  @IsOptional()
  name: string;

  @IsBoolean()
  @Equals(true, { message: 'You must have to accpet the terms and conditions' })
  termsAndConditions: boolean;
}
