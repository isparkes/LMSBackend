import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { Lesson, LessonType } from '../lessons/entities/lesson.entity';
import { UserProgress } from '../progress/entities/user-progress.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly questionsRepository: Repository<QuizQuestion>,
    @InjectRepository(QuizAttempt)
    private readonly attemptsRepository: Repository<QuizAttempt>,
    @InjectRepository(Lesson)
    private readonly lessonsRepository: Repository<Lesson>,
    @InjectRepository(UserProgress)
    private readonly progressRepository: Repository<UserProgress>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createQuestion(
    lessonId: string,
    dto: CreateQuestionDto,
  ): Promise<QuizQuestion> {
    const lesson = await this.lessonsRepository.findOneBy({ id: lessonId });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.type !== LessonType.QUIZ) {
      throw new BadRequestException('Questions can only be added to quiz lessons');
    }
    if (dto.multiSelect && dto.correctOptionIndices) {
      for (const idx of dto.correctOptionIndices) {
        if (idx >= dto.options.length) {
          throw new BadRequestException(
            'All correctOptionIndices must be valid indices within the options array',
          );
        }
      }
      if (dto.correctOptionIndices.length === 0) {
        throw new BadRequestException(
          'correctOptionIndices must contain at least one index',
        );
      }
    } else if (dto.correctOptionIndex >= dto.options.length) {
      throw new BadRequestException(
        'correctOptionIndex must be a valid index within the options array',
      );
    }
    const question = this.questionsRepository.create({ ...dto, lessonId });
    return this.questionsRepository.save(question);
  }

  async updateQuestion(
    id: string,
    dto: UpdateQuestionDto,
  ): Promise<QuizQuestion> {
    const question = await this.questionsRepository.findOneBy({ id });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    const update = dto as Partial<CreateQuestionDto>;
    if (
      update.correctOptionIndex !== undefined &&
      update.options &&
      update.correctOptionIndex >= update.options.length
    ) {
      throw new BadRequestException(
        'correctOptionIndex must be a valid index within the options array',
      );
    }
    Object.assign(question, dto);
    return this.questionsRepository.save(question);
  }

  async removeQuestion(id: string): Promise<void> {
    const result = await this.questionsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Question not found');
    }
  }

  async submitAnswers(userId: string, lessonId: string, dto: SubmitAnswersDto) {
    const lesson = await this.lessonsRepository.findOneBy({ id: lessonId });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.type !== LessonType.QUIZ) {
      throw new BadRequestException('This lesson is not a quiz');
    }

    // Enforce attempt limit
    const maxAttempts = lesson.maxAttempts || 0;
    if (maxAttempts > 0) {
      const attemptCount = await this.attemptsRepository.count({
        where: { userId, lessonId },
      });
      if (attemptCount >= maxAttempts) {
        throw new BadRequestException(
          `Maximum number of attempts (${maxAttempts}) reached. Contact your administrator to reset.`,
        );
      }
    }

    const questions = await this.questionsRepository.find({
      where: { lessonId },
      order: { order: 'ASC' },
    });

    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions');
    }

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const results = dto.answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question ${answer.questionId} does not belong to this quiz`,
        );
      }

      let isCorrect: boolean;
      if (question.multiSelect && question.correctOptionIndices) {
        const selected = new Set(answer.selectedOptionIndices || []);
        const correct = new Set(question.correctOptionIndices);
        isCorrect =
          selected.size === correct.size &&
          [...correct].every((i) => selected.has(i));
      } else {
        isCorrect =
          answer.selectedOptionIndex === question.correctOptionIndex;
      }

      if (isCorrect) correctCount++;
      return {
        questionId: answer.questionId,
        selectedOptionIndex: answer.selectedOptionIndex,
        selectedOptionIndices: answer.selectedOptionIndices,
        correctOptionIndex: question.correctOptionIndex,
        correctOptionIndices: question.correctOptionIndices,
        multiSelect: question.multiSelect || false,
        isCorrect,
      };
    });

    const score = questions.length > 0 ? correctCount / questions.length : 0;
    const scorePercentage = Math.round(score * 100);
    const passMarkPercentage = lesson.passMarkPercentage || 0;
    const passed =
      passMarkPercentage === 0 || scorePercentage >= passMarkPercentage;

    // Record attempt when pass mark or attempt limit is configured
    if (passMarkPercentage > 0 || maxAttempts > 0) {
      const attempt = this.attemptsRepository.create({
        userId,
        lessonId,
        score,
        passed,
        answers: results,
      });
      await this.attemptsRepository.save(attempt);
    }

    // Count attempts after saving
    const attemptsTaken = (passMarkPercentage > 0 || maxAttempts > 0)
      ? await this.attemptsRepository.count({ where: { userId, lessonId } })
      : 0;

    // Upsert progress — only mark completed if passed
    let progress = await this.progressRepository.findOneBy({
      userId,
      lessonId,
    });
    if (!progress) {
      progress = this.progressRepository.create({ userId, lessonId });
    }
    if (passed) {
      progress.completed = true;
      progress.completedAt = new Date();
    }
    progress.score = score;
    await this.progressRepository.save(progress);

    return {
      totalQuestions: questions.length,
      correctAnswers: correctCount,
      score,
      passed,
      passMarkPercentage,
      maxAttempts,
      attemptsTaken,
      showCorrectAnswers: lesson.showCorrectAnswers !== false,
      results: lesson.showCorrectAnswers === false
        ? results.map((r) => ({
            questionId: r.questionId,
            selectedOptionIndex: r.selectedOptionIndex,
            selectedOptionIndices: r.selectedOptionIndices,
            multiSelect: r.multiSelect,
          }))
        : results,
    };
  }

  async getAttempts(userId: string, lessonId: string) {
    const attempts = await this.attemptsRepository.find({
      where: { userId, lessonId },
      order: { createdAt: 'DESC' },
    });
    return attempts.map(({ id, score, passed, createdAt }) => ({
      id,
      score,
      passed,
      createdAt,
    }));
  }

  async getAttemptsAdmin(lessonId: string) {
    const attempts = await this.attemptsRepository.find({
      where: { lessonId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const userMap = new Map<
      string,
      { id: string; name: string; email: string; attemptCount: number; bestScore: number; passed: boolean }
    >();

    for (const attempt of attempts) {
      const existing = userMap.get(attempt.userId);
      if (existing) {
        existing.attemptCount++;
        if (attempt.score > existing.bestScore) existing.bestScore = attempt.score;
        if (attempt.passed) existing.passed = true;
      } else {
        userMap.set(attempt.userId, {
          id: attempt.userId,
          name: attempt.user ? `${attempt.user.firstName} ${attempt.user.lastName}` : '',
          email: attempt.user?.email || '',
          attemptCount: 1,
          bestScore: attempt.score,
          passed: attempt.passed,
        });
      }
    }

    return Array.from(userMap.values());
  }

  async resetAttempts(userId: string, lessonId: string) {
    await this.attemptsRepository.delete({ userId, lessonId });
    // Also reset progress so user can retake
    const progress = await this.progressRepository.findOneBy({
      userId,
      lessonId,
    });
    if (progress) {
      progress.completed = false;
      progress.score = null;
      progress.completedAt = null;
      await this.progressRepository.save(progress);
    }
    return { message: 'Attempts reset successfully' };
  }
}
