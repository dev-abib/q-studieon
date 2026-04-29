import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsInt,
  IsIn,
  minLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password: string;

  @IsOptional()
  name?: string;

  @IsInt()
  age: number;
}
