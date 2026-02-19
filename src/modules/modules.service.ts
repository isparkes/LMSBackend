import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseModule } from './entities/module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(CourseModule)
    private readonly modulesRepository: Repository<CourseModule>,
  ) {}

  async findAllByCourse(courseId: string): Promise<CourseModule[]> {
    return this.modulesRepository.find({
      where: { courseId },
      order: { order: 'ASC' },
    });
  }

  async findOne(id: string): Promise<CourseModule> {
    const module = await this.modulesRepository.findOne({
      where: { id },
      relations: ['lessons'],
      order: { lessons: { order: 'ASC' } },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    return module;
  }

  async create(courseId: string, dto: CreateModuleDto): Promise<CourseModule> {
    const module = this.modulesRepository.create({ ...dto, courseId });
    return this.modulesRepository.save(module);
  }

  async update(id: string, dto: UpdateModuleDto): Promise<CourseModule> {
    const module = await this.modulesRepository.findOneBy({ id });
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    Object.assign(module, dto);
    return this.modulesRepository.save(module);
  }

  async remove(id: string): Promise<void> {
    const result = await this.modulesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Module not found');
    }
  }
}
