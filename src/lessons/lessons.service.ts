import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './entities/lesson.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonsRepository: Repository<Lesson>,
  ) {}

  async findAllByModule(moduleId: string): Promise<Lesson[]> {
    return this.lessonsRepository.find({
      where: { moduleId },
      order: { order: 'ASC' },
    });
  }

  async findOne(id: string, userRole: UserRole): Promise<Lesson> {
    const lesson = await this.lessonsRepository.findOne({
      where: { id },
      relations: ['quizQuestions'],
      order: { quizQuestions: { order: 'ASC' } },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Hide correct answers from learners
    if (userRole === UserRole.LEARNER && lesson.quizQuestions) {
      lesson.quizQuestions = lesson.quizQuestions.map((q) => ({
        ...q,
        correctOptionIndex: undefined as unknown as number,
        correctOptionIndices: undefined as unknown as number[],
      }));
    }

    return lesson;
  }

  async create(moduleId: string, dto: CreateLessonDto): Promise<Lesson> {
    const lesson = this.lessonsRepository.create({ ...dto, moduleId });
    return this.lessonsRepository.save(lesson);
  }

  async update(id: string, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.lessonsRepository.findOneBy({ id });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    Object.assign(lesson, dto);
    return this.lessonsRepository.save(lesson);
  }

  async remove(id: string): Promise<void> {
    const result = await this.lessonsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Lesson not found');
    }
  }

  async findByVideoFilename(filename: string): Promise<Lesson[]> {
    return this.lessonsRepository.find({ where: { videoFilename: filename } });
  }

  async findByPdfFilename(filename: string): Promise<Lesson[]> {
    return this.lessonsRepository.find({ where: { pdfFilename: filename } });
  }

  async updateVideoFilename(
    oldFilename: string,
    newFilename: string | null,
  ): Promise<void> {
    await this.lessonsRepository.update(
      { videoFilename: oldFilename },
      { videoFilename: newFilename as string },
    );
  }

  async updatePdfFilename(
    oldFilename: string,
    newFilename: string | null,
  ): Promise<void> {
    await this.lessonsRepository.update(
      { pdfFilename: oldFilename },
      { pdfFilename: newFilename as string },
    );
  }
}
