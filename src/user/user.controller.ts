import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { NoGuest } from '../auth/decorators/no-guest.decorator';
import { createFileUploadInterceptor } from '../common/interceptors/file-upload.interceptor';
import {
  FileValidationPipe,
  type MulterFile,
} from '../common/pipes/file-validation.pipe';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('user')
export class UserController {
  constructor(private readonly user: UserService) {}

  // get me controller
  @Get('get-me')
  @HttpCode(200)
  @Auth('user')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.user.getMe(user.id);
  }

  // get user by id controller
  @Get('user/:id')
  @HttpCode(200)
  @Auth('user')
  @NoGuest()
  getUserById(@Param('id') id: string) {
    return this.user.getMe(id);
  }

  // update user controller
  @Patch('update-user')
  @HttpCode(200)
  @Auth('user')
  @NoGuest()
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'profilePicture' }))
  updateUser(
    @Body() dto: UpdateUserDto,
    @UploadedFile(new FileValidationPipe({ required: false, maxSizeMB: 5 }))
    profilePicture: MulterFile,
    @CurrentUser() user: JwtPayload,
  ) {
    const hasBodyField = Object.keys(dto).some(
      (key) => dto[key as keyof UpdateUserDto] !== undefined,
    );

    if (!hasBodyField && !profilePicture) {
      throw new BadRequestException('At least one field must be provided');
    }

    return this.user.updateUser(dto, user.id, profilePicture);
  }

  // delete user controller
  @Delete('delete-account')
  @HttpCode(204)
  @Auth('user')
  @NoGuest()
  deleteUser(@Body() dto: DeleteAccountDto, @CurrentUser() user: JwtPayload) {
    return this.user.deleteUser(dto, user.id);
  }
}
