import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login screen' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Use Tailwind CSS and responsive layout', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'staff_user_id' })
  @IsString()
  @IsNotEmpty()
  assigneeId: string;

  @ApiProperty({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ example: '2026-08-31T23:59:59.000Z', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
