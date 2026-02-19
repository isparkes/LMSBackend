import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { videoStorageConfig, pdfStorageConfig } from './uploads.config';
import { UploadsService, FileEntry } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('video')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('video', videoStorageConfig))
  uploadVideo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('pdf')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('pdf', pdfStorageConfig))
  uploadPdf(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get('videos')
  @Roles(UserRole.ADMIN)
  listVideos(): Promise<FileEntry[]> {
    return this.uploadsService.listFiles('videos');
  }

  @Get('pdfs')
  @Roles(UserRole.ADMIN)
  listPdfs(): Promise<FileEntry[]> {
    return this.uploadsService.listFiles('pdfs');
  }

  @Delete('videos/:filename')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVideo(@Param('filename') filename: string): Promise<void> {
    return this.uploadsService.deleteFile('videos', filename);
  }

  @Delete('pdfs/:filename')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePdf(@Param('filename') filename: string): Promise<void> {
    return this.uploadsService.deleteFile('pdfs', filename);
  }

  @Patch('videos/:filename/rename')
  @Roles(UserRole.ADMIN)
  async renameVideo(
    @Param('filename') filename: string,
    @Body() body: { newDisplayName: string },
  ): Promise<{ newFilename: string }> {
    const newFilename = await this.uploadsService.renameFile(
      'videos',
      filename,
      body.newDisplayName,
    );
    return { newFilename };
  }

  @Patch('pdfs/:filename/rename')
  @Roles(UserRole.ADMIN)
  async renamePdf(
    @Param('filename') filename: string,
    @Body() body: { newDisplayName: string },
  ): Promise<{ newFilename: string }> {
    const newFilename = await this.uploadsService.renameFile(
      'pdfs',
      filename,
      body.newDisplayName,
    );
    return { newFilename };
  }
}
