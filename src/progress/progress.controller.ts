import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProgressService } from './progress.service';
import { MarkCompleteDto } from './dto/mark-complete.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Post('complete')
  markComplete(
    @CurrentUser() user: { id: string },
    @Body() dto: MarkCompleteDto,
  ) {
    return this.progressService.markComplete(user.id, dto.lessonId);
  }

  @Get('admin/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getAdminOverview() {
    return this.progressService.getAdminOverview();
  }

  @Get('admin/users/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getUserDetailedProgress(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.progressService.getUserDetailedProgress(userId);
  }

  @Delete('admin/users/:userId/courses/:courseId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  resetCourseProgress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.progressService.resetCourseProgress(userId, courseId);
  }

  @Delete('admin/users/:userId/modules/:moduleId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  resetModuleProgress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.progressService.resetModuleProgress(userId, moduleId);
  }

  @Get('courses/:courseId')
  getCourseProgress(
    @CurrentUser() user: { id: string },
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.progressService.getCourseProgress(user.id, courseId);
  }
}
