import {
  IsString,
  IsArray,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  questionText: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  options: string[];

  @IsInt()
  @Min(0)
  correctOptionIndex: number;

  @IsBoolean()
  @IsOptional()
  multiSelect?: boolean;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  correctOptionIndices?: number[];

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
