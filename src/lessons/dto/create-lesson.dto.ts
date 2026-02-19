import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { LessonType } from '../entities/lesson.entity';

export class CreateLessonDto {
  @IsString()
  title: string;

  @IsEnum(LessonType)
  type: LessonType;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ValidateIf((o) => o.type === LessonType.TEXT)
  @IsString()
  content?: string;

  @ValidateIf((o) => o.type === LessonType.VIDEO)
  @IsString()
  videoFilename?: string;

  @ValidateIf((o) => o.type === LessonType.PDF)
  @IsString()
  pdfFilename?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateIf((o) => o.type === LessonType.QUIZ)
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  passMarkPercentage?: number;

  @ValidateIf((o) => o.type === LessonType.QUIZ)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxAttempts?: number;

  @ValidateIf((o) => o.type === LessonType.QUIZ)
  @IsBoolean()
  @IsOptional()
  randomizeQuestions?: boolean;

  @ValidateIf((o) => o.type === LessonType.QUIZ)
  @IsBoolean()
  @IsOptional()
  randomizeAnswers?: boolean;

  @ValidateIf((o) => o.type === LessonType.QUIZ)
  @IsBoolean()
  @IsOptional()
  showCorrectAnswers?: boolean;
}
