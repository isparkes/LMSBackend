import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async findAll(userRole: UserRole): Promise<Course[]> {
    const where = userRole === UserRole.LEARNER ? { isPublished: true } : {};
    return this.coursesRepository.find({
      where,
      order: { ordering: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string, userRole: UserRole): Promise<Course> {
    const where: Record<string, unknown> =
      userRole === UserRole.LEARNER ? { id, isPublished: true } : { id };
    const course = await this.coursesRepository.findOne({
      where,
      relations: ['modules', 'modules.lessons'],
      order: {
        modules: { order: 'ASC', lessons: { order: 'ASC' } },
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
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
