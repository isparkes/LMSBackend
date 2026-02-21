import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CourseModule } from '../../modules/entities/module.entity';

@Entity('courses')
export class Course extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  requireEnrollment: boolean;

  @Column({ type: 'int', default: 0 })
  ordering: number;

  @OneToMany(() => CourseModule, (module) => module.course, { cascade: true })
  modules: CourseModule[];
}
