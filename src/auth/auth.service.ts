import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.updateLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate cryptographically secure random token
    const plainToken = randomBytes(32).toString('hex'); // 64 characters
    const tokenHash = await bcrypt.hash(plainToken, 10);

    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Save token
    await this.passwordResetTokenRepository.save({
      userId: user.id,
      tokenHash,
      expiresAt,
      used: false,
    });

    // Send email with reset link
    await this.emailService.sendPasswordResetEmail(user.email, plainToken);

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  async resetPassword(
    plainToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Find all non-used, non-expired tokens
    const tokens = await this.passwordResetTokenRepository.find({
      where: {
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    // Find matching token by comparing hashes
    let matchedToken: PasswordResetToken | null = null;
    for (const token of tokens) {
      const matches = await bcrypt.compare(plainToken, token.tokenHash);
      if (matches) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Mark token as used
    matchedToken.used = true;
    matchedToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(matchedToken);

    // Update user password
    await this.usersService.updatePassword(matchedToken.userId, newPassword);

    // Optionally: Invalidate all other tokens for this user
    await this.passwordResetTokenRepository.update(
      { userId: matchedToken.userId, used: false },
      { used: true, usedAt: new Date() },
    );

    return { message: 'Password successfully reset' };
  }

  private buildAuthResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
