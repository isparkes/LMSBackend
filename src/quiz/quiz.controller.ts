import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('lessons/:lessonId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Post('questions')
  @Roles(UserRole.ADMIN)
  createQuestion(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.quizService.createQuestion(lessonId, dto);
  }

  @Patch('questions/:id')
  @Roles(UserRole.ADMIN)
  updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.quizService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeQuestion(@Param('id', ParseUUIDPipe) id: string) {
    return this.quizService.removeQuestion(id);
  }

  @Post('submit')
  submitAnswers(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.quizService.submitAnswers(user.id, lessonId, dto);
  }

  @Get('attempts')
  getAttempts(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.quizService.getAttempts(user.id, lessonId);
  }

  @Get('attempts/admin')
  @Roles(UserRole.ADMIN)
  getAttemptsAdmin(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.quizService.getAttemptsAdmin(lessonId);
  }

  @Post('reset-attempts/:userId')
  @Roles(UserRole.ADMIN)
  resetAttempts(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.quizService.resetAttempts(userId, lessonId);
  }
}
