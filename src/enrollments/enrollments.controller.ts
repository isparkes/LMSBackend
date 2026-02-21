import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EnrollmentStatus } from './entities/enrollment.entity';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.enroll(dto.userId, dto.courseId);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN)
  bulkCreate(@Body() dto: BulkEnrollmentDto) {
    return this.enrollmentsService.bulkEnroll(dto.userIds, dto.courseId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: QueryEnrollmentDto) {
    return this.enrollmentsService.findAll(query);
  }

  @Get('my-courses')
  getMyEnrollments(@CurrentUser() user: { id: string }) {
    return this.enrollmentsService.findUserEnrollments(
      user.id,
      EnrollmentStatus.ACTIVE,
    );
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN)
  getUserEnrollments(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.enrollmentsService.findUserEnrollments(userId);
  }

  @Get('course/:courseId')
  @Roles(UserRole.ADMIN)
  getCourseEnrollments(@Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.enrollmentsService.findCourseEnrollments(courseId);
  }

  @Delete(':userId/:courseId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.enrollmentsService.unenroll(userId, courseId);
  }
}
