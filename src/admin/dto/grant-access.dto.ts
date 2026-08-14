import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccessDurationPlan {
  ONE_MONTH = '1_month',
  THREE_MONTHS = '3_months',
  SIX_MONTHS = '6_months',
  ONE_YEAR = '1_year',
  CUSTOM = 'custom',
  LIFETIME = 'lifetime',
}

export class GrantAccessDto {
  @ApiProperty({
    description: 'Duration plan for complimentary / admin-granted subscription',
    enum: AccessDurationPlan,
    example: AccessDurationPlan.ONE_MONTH,
  })
  @IsEnum(AccessDurationPlan)
  @IsNotEmpty()
  plan: AccessDurationPlan;

  @ApiPropertyOptional({
    description: 'Custom end date (ISO string or YYYY-MM-DD), required if plan is custom',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsString()
  customEndDate?: string;

  @ApiPropertyOptional({
    description: 'Reason or note for granting access (e.g. VIP client, partnership, trial)',
    example: 'Complimentary partnership access',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Billing cycle label to display (monthly or yearly)',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
  })
  @IsOptional()
  @IsString()
  billingCycle?: 'monthly' | 'yearly';
}

export class RevokeAccessDto {
  @ApiPropertyOptional({
    description: 'Reason for revoking admin-granted access',
    example: 'Trial period ended / manually revoked by administrator',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
