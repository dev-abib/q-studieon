import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import { Readable } from 'stream';
import { MulterFile } from '../pipes/file-validation.pipe';

export interface UploadResult {
  url: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly baseFolder: string;

  constructor() {
    this.baseFolder = process.env.CLOUDINARY_BASE_FOLDER ?? 'my-app';

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(
    file: MulterFile,
    folder: string = 'uploads',
  ): Promise<UploadResult> {
    const fullFolder = `${this.baseFolder}/${folder}`;

    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: fullFolder, resource_type: 'auto' },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            reject(new Error(error.message));
            return;
          }
          if (!result) {
            reject(new Error('Upload failed: no result returned'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );

      Readable.from(Buffer.from(file.buffer)).pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
