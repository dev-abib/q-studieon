// src/common/repositories/user.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import bcrypt from 'bcrypt';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(
    type: 'email' | 'id' = 'email',
    payload: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: type === 'email' ? { email: payload } : { id: payload },
    });

    if (!user)
      throw new NotFoundException('User not found, account removed or deleted');

    return user;
  }

  async comparePassword(
    password: string,
    hashPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashPassword);
  }

  // log out service
  async logOut(id: string) {
    const user = await this.findUser('id', id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: null,
      },
    });

    return {
      message: 'Log out successfully',
    };
  }
}
