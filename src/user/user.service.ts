import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/infra/mail/mail.service';
import { UserRepository } from 'src/common/repositories/user.repository';
import { CloudinaryService } from 'src/common/services/cloudinary.service';
import { MulterFile } from 'src/common/pipes/file-validation.pipe';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly userRepo: UserRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // get me service
  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: id },
    });

    if (!user)
      throw new NotFoundException(
        ' User not found, account removed or deleted,',
      );

    const {
      password,
      otp,
      otpAttempts,
      otpExpires,
      refreshToken,
      resetToken,
      ...safeUser
    } = user;

    return {
      message: 'User extracted successfully',
      data: safeUser,
    };
  }

  // update user service
  async updateUser(dto: UpdateUserDto, id: string, profilePicture: MulterFile) {
    const user = await this.userRepo.findUser('id', id);

    let newProfilePictureURL: string | undefined;
    let newProfilePicturePublicId: string | undefined;

    if (profilePicture) {
      if (user.profilePicturePublicId) {
        await this.cloudinary.deleteFile(user.profilePicturePublicId);
      }

      const uploaded = await this.cloudinary.uploadFile(
        profilePicture,
        'profile-pictures',
      );
      newProfilePictureURL = uploaded.url;
      newProfilePicturePublicId = uploaded.publicId;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        ...(newProfilePictureURL && {
          profilePictureURL: newProfilePictureURL,
        }),
        ...(newProfilePicturePublicId && {
          profilePicturePublicId: newProfilePicturePublicId,
        }),
      },
    });

    const {
      password,
      otp,
      otpAttempts,
      otpExpires,
      refreshToken,
      resetToken,
      profilePicturePublicId, 
      ...safeUser
    } = updated;

    return {
      message: 'Profile updated successfully',
      data: safeUser,
    };
  }
}
