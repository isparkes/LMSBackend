import { IsArray, IsUUID } from 'class-validator';

export class BulkEnrollmentDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsUUID()
  courseId: string;
}
