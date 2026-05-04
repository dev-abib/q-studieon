// src/common/repositories/user.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';

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
}
