import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from './entities/user-progress.entity';
import { Lesson, LessonType } from '../lessons/entities/lesson.entity';
import { CourseModule } from '../modules/entities/module.entity';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';
import { QuizAttempt } from '../quiz/entities/quiz-attempt.entity';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(UserProgress)
    private readonly progressRepository: Repository<UserProgress>,
    @InjectRepository(Lesson)
    private readonly lessonsRepository: Repository<Lesson>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(QuizAttempt)
    private readonly attemptsRepository: Repository<QuizAttempt>,
  ) {}

  async markComplete(userId: string, lessonId: string): Promise<UserProgress> {
    const lesson = await this.lessonsRepository.findOneBy({ id: lessonId });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.type === LessonType.QUIZ) {
      throw new BadRequestException(
        'Quiz lessons are completed by submitting answers',
      );
    }

    let progress = await this.progressRepository.findOneBy({
      userId,
      lessonId,
    });
    if (progress?.completed) {
      return progress;
    }

    if (!progress) {
      progress = this.progressRepository.create({ userId, lessonId });
    }
    progress.completed = true;
    progress.completedAt = new Date();
    return this.progressRepository.save(progress);
  }

  async getCourseProgress(userId: string, courseId: string) {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      relations: ['modules', 'modules.lessons'],
      order: {
        modules: { order: 'ASC', lessons: { order: 'ASC' } },
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Fetch all progress for this user in this course in one query
    const progressRecords = await this.progressRepository
      .createQueryBuilder('up')
      .innerJoin('up.lesson', 'lesson')
      .innerJoin('lesson.module', 'module')
      .where('up.userId = :userId', { userId })
      .andWhere('module.courseId = :courseId', { courseId })
      .andWhere('up.completed = true')
      .getMany();

    const progressMap = new Map(
      progressRecords.map((p) => [p.lessonId, p]),
    );

    let totalLessons = 0;
    let completedLessons = 0;

    const modules = course.modules.map((mod: CourseModule) => {
      let moduleCompleted = 0;
      const lessons = mod.lessons.map((lesson: Lesson) => {
        totalLessons++;
        const progress = progressMap.get(lesson.id);
        const completed = !!progress;
        if (completed) {
          completedLessons++;
          moduleCompleted++;
        }
        return {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonType: lesson.type,
          completed,
          score: progress?.score ?? null,
          completedAt: progress?.completedAt ?? null,
          passMarkPercentage: lesson.type === LessonType.QUIZ ? lesson.passMarkPercentage : 0,
        };
      });

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        totalLessons: mod.lessons.length,
        completedLessons: moduleCompleted,
        lessons,
      };
    });

    return {
      courseId: course.id,
      courseTitle: course.title,
      totalLessons,
      completedLessons,
      progressPercentage:
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0,
      modules,
    };
  }

  async getUserDetailedProgress(userId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const courses = await this.coursesRepository.find({
      relations: ['modules', 'modules.lessons'],
      order: { modules: { order: 'ASC', lessons: { order: 'ASC' } } },
    });

    const allProgress = await this.progressRepository.find({
      where: { userId },
    });
    const progressMap = new Map(allProgress.map((p) => [p.lessonId, p]));

    const allAttempts = await this.attemptsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const attemptsMap = new Map<string, QuizAttempt[]>();
    for (const attempt of allAttempts) {
      if (!attemptsMap.has(attempt.lessonId)) {
        attemptsMap.set(attempt.lessonId, []);
      }
      attemptsMap.get(attempt.lessonId)!.push(attempt);
    }

    return courses.map((course) => {
      let totalLessons = 0;
      let completedLessons = 0;

      const modules = course.modules.map((mod: CourseModule) => {
        let moduleCompleted = 0;
        const lessons = mod.lessons.map((lesson: Lesson) => {
          totalLessons++;
          const progress = progressMap.get(lesson.id);
          const completed = !!progress?.completed;
          if (completed) {
            completedLessons++;
            moduleCompleted++;
          }

          const base = {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonType: lesson.type,
            completed,
            score: progress?.score ?? null,
            completedAt: progress?.completedAt ?? null,
          };

          if (lesson.type === LessonType.QUIZ) {
            const attempts = attemptsMap.get(lesson.id) || [];
            const bestScore =
              attempts.length > 0
                ? Math.max(...attempts.map((a) => a.score))
                : null;
            const passed = attempts.some((a) => a.passed);
            return {
              ...base,
              quiz: {
                attemptCount: attempts.length,
                maxAttempts: lesson.maxAttempts,
                passMarkPercentage: lesson.passMarkPercentage,
                bestScore,
                passed,
              },
            };
          }
          return { ...base, quiz: null };
        });

        return {
          moduleId: mod.id,
          moduleTitle: mod.title,
          totalLessons: mod.lessons.length,
          completedLessons: moduleCompleted,
          lessons,
        };
      });

      return {
        courseId: course.id,
        courseTitle: course.title,
        totalLessons,
        completedLessons,
        progressPercentage:
          totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0,
        modules,
      };
    });
  }

  async resetCourseProgress(userId: string, courseId: string) {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      relations: ['modules', 'modules.lessons'],
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const lessonIds: string[] = [];
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        lessonIds.push(lesson.id);
      }
    }

    if (lessonIds.length > 0) {
      await this.progressRepository
        .createQueryBuilder()
        .delete()
        .where('userId = :userId AND lessonId IN (:...lessonIds)', { userId, lessonIds })
        .execute();

      await this.attemptsRepository
        .createQueryBuilder()
        .delete()
        .where('userId = :userId AND lessonId IN (:...lessonIds)', { userId, lessonIds })
        .execute();
    }

    return { message: 'Course progress reset successfully' };
  }

  async resetModuleProgress(userId: string, moduleId: string) {
    const mod = await this.lessonsRepository.find({
      where: { moduleId },
    });
    if (mod.length === 0) {
      // Module may exist but have no lessons, or not exist - either way nothing to reset
      return { message: 'Module progress reset successfully' };
    }

    const lessonIds = mod.map((l) => l.id);

    await this.progressRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :userId AND lessonId IN (:...lessonIds)', { userId, lessonIds })
      .execute();

    await this.attemptsRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :userId AND lessonId IN (:...lessonIds)', { userId, lessonIds })
      .execute();

    return { message: 'Module progress reset successfully' };
  }

  async getAdminOverview() {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
    const courses = await this.coursesRepository.find({
      relations: ['modules', 'modules.lessons'],
    });

    // Build a map of totalLessons per course
    const courseLessonCounts = new Map<string, number>();
    for (const course of courses) {
      let total = 0;
      for (const mod of course.modules) {
        total += mod.lessons.length;
      }
      courseLessonCounts.set(course.id, total);
    }

    // Fetch all completed progress records in one query
    const allProgress = await this.progressRepository
      .createQueryBuilder('up')
      .innerJoin('up.lesson', 'lesson')
      .innerJoin('lesson.module', 'module')
      .select('up.userId', 'userId')
      .addSelect('module.courseId', 'courseId')
      .addSelect('COUNT(*)', 'completedCount')
      .where('up.completed = true')
      .groupBy('up.userId')
      .addGroupBy('module.courseId')
      .getRawMany<{
        userId: string;
        courseId: string;
        completedCount: string;
      }>();

    // Build a lookup: userId -> courseId -> completedCount
    const progressMap = new Map<string, Map<string, number>>();
    for (const row of allProgress) {
      if (!progressMap.has(row.userId)) {
        progressMap.set(row.userId, new Map());
      }
      progressMap.get(row.userId)!.set(row.courseId, parseInt(row.completedCount, 10));
    }

    return users.map((user) => {
      const userProgress = progressMap.get(user.id);
      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        courses: courses.map((course) => {
          const totalLessons = courseLessonCounts.get(course.id) || 0;
          const completed = userProgress?.get(course.id) || 0;
          return {
            courseId: course.id,
            courseTitle: course.title,
            totalLessons,
            completedLessons: completed,
            progressPercentage:
              totalLessons > 0
                ? Math.round((completed / totalLessons) * 100)
                : 0,
          };
        }),
      };
    });
  }
}
