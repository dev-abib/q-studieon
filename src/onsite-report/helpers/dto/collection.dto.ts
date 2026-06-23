import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AddReportToCollectionDto {
  @IsString()
  @IsNotEmpty()
  reportId!: string;
}
