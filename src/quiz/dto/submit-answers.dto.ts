import {
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsString()
  questionId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  selectedOptionIndex?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  selectedOptionIndices?: number[];
}

export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
