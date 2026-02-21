import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EnrollmentStatus } from '../entities/enrollment.entity';

export class QueryEnrollmentDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
