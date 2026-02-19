import { diskStorage } from 'multer';
import { extname, basename } from 'path';
import { BadRequestException } from '@nestjs/common';

function sanitizeFilename(originalname: string): string {
  const ext = extname(originalname);
  const stem = basename(originalname, ext);
  const safeStem = stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safeStem || 'file'}${ext.toLowerCase()}`;
}

const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

export const videoStorageConfig = {
  storage: diskStorage({
    destination: './uploads/videos',
    filename: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueName = sanitizeFilename(file.originalname);
      callback(null, uniqueName);
    },
  }),
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (ALLOWED_VIDEO_MIMES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Invalid file type. Only video files (mp4, webm, ogg, mov) are allowed.',
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
};

export const pdfStorageConfig = {
  storage: diskStorage({
    destination: './uploads/pdfs',
    filename: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueName = sanitizeFilename(file.originalname);
      callback(null, uniqueName);
    },
  }),
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype === 'application/pdf') {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Invalid file type. Only PDF files are allowed.',
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
};
