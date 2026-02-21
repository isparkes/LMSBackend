import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { lastLoginAt: new Date() });
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    await this.usersRepository.save(user);
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    // Check for existing user
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role ?? UserRole.LEARNER,
    });

    return this.usersRepository.save(user);
  }

  async deleteUser(userId: string, currentUserId: string): Promise<void> {
    // Prevent self-deletion
    if (userId === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TypeORM cascade delete will handle:
    // - UserProgress (via @ManyToOne onDelete: 'CASCADE')
    // - QuizAttempt (via @ManyToOne onDelete: 'CASCADE')
    // - Enrollment (via @ManyToOne onDelete: 'CASCADE')

    await this.usersRepository.remove(user);
  }
}
