import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PlanType {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class SubscriptionDto {
  @ApiProperty({ example: 'monthly', description: 'Subscription plan type', enum: PlanType })
  @IsEnum(PlanType)
  plan!: PlanType;
}
