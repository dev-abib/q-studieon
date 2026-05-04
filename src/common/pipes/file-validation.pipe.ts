import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

export interface FileValidationOptions {
  allowedMimeTypes?: string[];
  maxSizeMB?: number;
  required?: boolean;
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions = {}) {}

  transform(file: MulterFile | undefined): MulterFile | undefined {
    const {
      allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'],
      maxSizeMB = 5,
      required = false,
    } = this.options;

    if (!file) {
      if (required) throw new BadRequestException('File is required');
      return undefined;
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new BadRequestException(`File size must not exceed ${maxSizeMB}MB`);
    }

    return file;
  }
}
