import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CourseModule } from '../../modules/entities/module.entity';
import { QuizQuestion } from '../../quiz/entities/quiz-question.entity';

export enum LessonType {
  VIDEO = 'video',
  TEXT = 'text',
  QUIZ = 'quiz',
  PDF = 'pdf',
}

@Entity('lessons')
export class Lesson extends BaseEntity {
  @Column()
  moduleId: string;

  @ManyToOne(() => CourseModule, (module) => module.lessons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'moduleId' })
  module: CourseModule;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: LessonType })
  type: LessonType;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ nullable: true })
  videoFilename: string;

  @Column({ nullable: true })
  pdfFilename: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'int', default: 0 })
  passMarkPercentage: number;

  @Column({ type: 'int', default: 0 })
  maxAttempts: number;

  @Column({ default: false })
  randomizeQuestions: boolean;

  @Column({ default: false })
  randomizeAnswers: boolean;

  @Column({ default: true })
  showCorrectAnswers: boolean;

  @OneToMany(() => QuizQuestion, (question) => question.lesson, {
    cascade: true,
  })
  quizQuestions: QuizQuestion[];
}
