import { IsUUID } from 'class-validator';

export class MarkCompleteDto {
  @IsUUID()
  lessonId: string;
}
