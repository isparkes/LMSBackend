import { IsString, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsBoolean()
  @IsOptional()
  requireEnrollment?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  ordering?: number;
}
