import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { Enrollment } from '../enrollments/entities/enrollment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Course, Enrollment])],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
