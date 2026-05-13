import { IsEnum } from 'class-validator';

export enum PlanType {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class SubscriptionDto {
  @IsEnum(PlanType)
  plan!: PlanType;
}
