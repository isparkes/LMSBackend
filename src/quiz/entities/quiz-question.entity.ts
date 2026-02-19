import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Lesson } from '../../lessons/entities/lesson.entity';

@Entity('quiz_questions')
export class QuizQuestion extends BaseEntity {
  @Column()
  lessonId: string;

  @ManyToOne(() => Lesson, (lesson) => lesson.quizQuestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @Column({ type: 'text' })
  questionText: string;

  @Column({ type: 'jsonb' })
  options: string[];

  @Column({ type: 'int' })
  correctOptionIndex: number;

  @Column({ default: false })
  multiSelect: boolean;

  @Column({ type: 'jsonb', nullable: true })
  correctOptionIndices: number[];

  @Column({ type: 'int', default: 0 })
  order: number;
}
