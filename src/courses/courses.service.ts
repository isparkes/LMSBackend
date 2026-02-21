import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UserRole } from '../users/entities/user.entity';
import { Enrollment, EnrollmentStatus } from '../enrollments/entities/enrollment.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ) {}

  async findAll(userId: string, userRole: UserRole): Promise<Course[]> {
    if (userRole === UserRole.ADMIN) {
      // Admins see all courses
      return this.coursesRepository.find({
        order: { ordering: 'ASC', createdAt: 'ASC' },
      });
    }

    // Learners: get all published courses
    const allPublishedCourses = await this.coursesRepository.find({
      where: { isPublished: true },
      order: { ordering: 'ASC', createdAt: 'ASC' },
    });

    // Filter based on requireEnrollment flag
    const visibleCourses: Course[] = [];

    for (const course of allPublishedCourses) {
      if (!course.requireEnrollment) {
        // Open course - all learners can see
        visibleCourses.push(course);
      } else {
        // Enrollment required - check if user is enrolled
        const enrollment = await this.enrollmentRepository.findOne({
          where: {
            userId,
            courseId: course.id,
            status: EnrollmentStatus.ACTIVE,
          },
        });
        if (enrollment) {
          visibleCourses.push(course);
        }
      }
    }

    return visibleCourses;
  }

  async findOne(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['modules', 'modules.lessons'],
      order: {
        modules: { order: 'ASC', lessons: { order: 'ASC' } },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Admins can view any course
    if (userRole === UserRole.ADMIN) {
      return course;
    }

    // Learners: must be published
    if (!course.isPublished) {
      throw new NotFoundException('Course not found');
    }

    // If course requires enrollment, check enrollment status
    if (course.requireEnrollment) {
      const enrollment = await this.enrollmentRepository.findOne({
        where: {
          userId,
          courseId: course.id,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      if (!enrollment) {
        throw new NotFoundException('Course not found or not enrolled');
      }
    }

    return course;
  }

  async create(dto: CreateCourseDto): Promise<Course> {
    const course = this.coursesRepository.create(dto);
    return this.coursesRepository.save(course);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    Object.assign(course, dto);
    return this.coursesRepository.save(course);
  }

  async remove(id: string): Promise<void> {
    const result = await this.coursesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Course not found');
    }
  }
}
