import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteAdminDto {
  @ApiProperty({
    example: 'newmember@example.com',
    description: 'Email address of the invited team member',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'customer_support',
    enum: ['admin', 'customer_support', 'content_manager', 'finance', 'super_admin'],
    description: 'Assigned role for the invited team member',
  })
  @IsEnum(['admin', 'customer_support', 'content_manager', 'finance', 'super_admin'])
  role: 'admin' | 'customer_support' | 'content_manager' | 'finance' | 'super_admin';
}
