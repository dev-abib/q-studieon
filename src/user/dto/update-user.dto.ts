import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../../auth/decorators/at-least-one-filed.dto';
import { userRole } from '@prisma/client';

export class UpdateUserDto {
  @AtLeastOneField()
  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'User display name (min 4 chars)',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  name?: string;

  @ApiPropertyOptional({
    example: 'newemail@example.com',
    description: 'User email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'buyer',
    description:
      'User role: buyer, seller, renter, real_estate_agent, brokerage, practitioner, home_explorer, homeowner, investor, interior_designer, architect',
    enum: userRole,
  })
  @IsOptional()
  @IsEnum(userRole, { message: 'Invalid user role' })
  userRole?: userRole;
}
