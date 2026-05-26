import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export enum CaptureType {
  FRONT_ENTRANCE = 'front_entrance',
  KITCHEN = 'kitchen',
  BED = 'bed',
  WASHROOM = 'washroom',
  SOFA = 'sofa',
  OFFICE = 'office',
}

export class AddCaptureDto {
  @IsEnum(CaptureType)
  captureType: CaptureType;

  @IsNumber()
  @Min(0)
  @Max(359)
  bearingDegrees: number;

  @IsBoolean()
  @IsOptional()
  isMainEntrance?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
