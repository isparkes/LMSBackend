import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment, EnrollmentStatus } from './entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate course exists
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check for existing active enrollment
    const existing = await this.enrollmentRepository.findOne({
      where: { userId, courseId, status: EnrollmentStatus.ACTIVE },
    });
    if (existing) {
      throw new ConflictException('User is already enrolled in this course');
    }

    // Create enrollment
    const enrollment = this.enrollmentRepository.create({
      userId,
      courseId,
      status: EnrollmentStatus.ACTIVE,
    });

    return this.enrollmentRepository.save(enrollment);
  }

  async bulkEnroll(
    userIds: string[],
    courseId: string,
  ): Promise<{
    enrolled: Enrollment[];
    skipped: Array<{ userId: string; reason: string }>;
  }> {
    // Validate course exists
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const enrolled: Enrollment[] = [];
    const skipped: Array<{ userId: string; reason: string }> = [];

    for (const userId of userIds) {
      // Check if user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        skipped.push({ userId, reason: 'User not found' });
        continue;
      }

      // Check if already enrolled
      const existing = await this.enrollmentRepository.findOne({
        where: { userId, courseId, status: EnrollmentStatus.ACTIVE },
      });
      if (existing) {
        skipped.push({ userId, reason: 'Already enrolled' });
        continue;
      }

      // Create enrollment
      const enrollment = this.enrollmentRepository.create({
        userId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
      });

      const saved = await this.enrollmentRepository.save(enrollment);
      enrolled.push(saved);
    }

    return { enrolled, skipped };
  }

  async unenroll(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { userId, courseId, status: EnrollmentStatus.ACTIVE },
    });

    if (!enrollment) {
      throw new NotFoundException('Active enrollment not found');
    }

    // Soft delete: set status to UNENROLLED
    enrollment.status = EnrollmentStatus.UNENROLLED;
    enrollment.unenrolledAt = new Date();

    await this.enrollmentRepository.save(enrollment);
  }

  async findAll(query: QueryEnrollmentDto): Promise<Enrollment[]> {
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.courseId) {
      where.courseId = query.courseId;
    }

    if (query.status) {
      where.status = query.status;
    }

    return this.enrollmentRepository.find({
      where,
      relations: ['user', 'course'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async findUserEnrollments(
    userId: string,
    status?: EnrollmentStatus,
  ): Promise<Enrollment[]> {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    return this.enrollmentRepository.find({
      where,
      relations: ['course'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async findCourseEnrollments(
    courseId: string,
    status?: EnrollmentStatus,
  ): Promise<Enrollment[]> {
    const where: any = { courseId };

    if (status) {
      where.status = status;
    }

    return this.enrollmentRepository.find({
      where,
      relations: ['user'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { userId, courseId, status: EnrollmentStatus.ACTIVE },
    });

    return !!enrollment;
  }
}
