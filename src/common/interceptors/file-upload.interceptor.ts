import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { MulterFile } from '../pipes/file-validation.pipe';

export interface FileUploadOptions {
  fieldName: string;
  maxSizeMB?: number;
  allowedMimeTypes?: string[];
}

export function createFileUploadInterceptor({
  fieldName,
  maxSizeMB = 5,
  allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
}: FileUploadOptions) {
  const multerOptions: MulterOptions = {
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (
      _req: Request,
      file: MulterFile,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ): void => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(
          new BadRequestException(
            `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`,
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
  };

  return FileInterceptor(fieldName, multerOptions);
}
