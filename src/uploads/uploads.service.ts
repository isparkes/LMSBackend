import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { LessonsService } from '../lessons/lessons.service';

export interface FileEntry {
  filename: string;
  sizeBytes: number;
  uploadedAt: Date;
  usedByLessons: { id: string; title: string }[];
}

@Injectable()
export class UploadsService {
  constructor(private readonly lessonsService: LessonsService) {}

  async listFiles(type: 'videos' | 'pdfs'): Promise<FileEntry[]> {
    const dir = join(process.cwd(), 'uploads', type);

    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }

    const entries = await Promise.all(
      names.map(async (filename) => {
        const stat = await fs.stat(join(dir, filename));
        const lessons =
          type === 'videos'
            ? await this.lessonsService.findByVideoFilename(filename)
            : await this.lessonsService.findByPdfFilename(filename);

        return {
          filename,
          sizeBytes: stat.size,
          uploadedAt: stat.mtime,
          usedByLessons: lessons.map((l) => ({ id: l.id, title: l.title })),
        };
      }),
    );

    return entries.sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    );
  }

  async deleteFile(type: 'videos' | 'pdfs', filename: string): Promise<void> {
    const filePath = join(process.cwd(), 'uploads', type, filename);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(`File not found: ${filename}`);
    }

    if (type === 'videos') {
      await this.lessonsService.updateVideoFilename(filename, null);
    } else {
      await this.lessonsService.updatePdfFilename(filename, null);
    }

    await fs.unlink(filePath);
  }

  async renameFile(
    type: 'videos' | 'pdfs',
    oldFilename: string,
    newDisplayName: string,
  ): Promise<string> {
    const dir = join(process.cwd(), 'uploads', type);
    const oldPath = join(dir, oldFilename);

    try {
      await fs.access(oldPath);
    } catch {
      throw new NotFoundException(`File not found: ${oldFilename}`);
    }

    const ext = extname(oldFilename);
    const safeName = newDisplayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const newFilename = `${safeName}${ext}`;
    const newPath = join(dir, newFilename);

    if (newFilename === oldFilename) {
      return oldFilename;
    }

    try {
      await fs.access(newPath);
      throw new ConflictException(`A file named "${newFilename}" already exists`);
    } catch (err) {
      if (err instanceof ConflictException) throw err;
    }

    await fs.rename(oldPath, newPath);

    if (type === 'videos') {
      await this.lessonsService.updateVideoFilename(oldFilename, newFilename);
    } else {
      await this.lessonsService.updatePdfFilename(oldFilename, newFilename);
    }

    return newFilename;
  }
}
