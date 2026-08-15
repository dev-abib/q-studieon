import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetAllTasksDto } from './dto/get-all-tasks.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { TaskStatus } from '@prisma/client';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class TaskManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async createTask(creatorId: string, dto: CreateTaskDto) {
    // Verify assignee exists
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
    });
    if (!assignee) {
      throw new NotFoundException('Assignee user not found');
    }

    const task = await this.prisma.taskAssignment.create({
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        creatorId: creatorId,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, profilePictureURL: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const creatorName = task.creator?.name || task.creator?.email || 'An admin';
    this.chatGateway.sendNotificationToUser(
      dto.assigneeId,
      'New Task Assigned 📋',
      `"${dto.title}" has been assigned to you by ${creatorName}.`,
      { taskId: task.id }
    );

    return task;
  }

  async findAll(dto: GetAllTasksDto) {
    const where: any = {};

    if (dto.status) where.status = dto.status;
    if (dto.priority) where.priority = dto.priority;
    if (dto.assigneeId) where.assigneeId = dto.assigneeId;
    if (dto.creatorId) where.creatorId = dto.creatorId;

    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.taskAssignment.count({ where });

    const page = dto.page || 1;
    const limit = dto.limit || 12;
    const skip = (page - 1) * limit;

    const sortField = dto.sortField || 'createdAt';
    const sortOrder = dto.sortOrder || 'desc';
    const orderBy: any = {};
    orderBy[sortField] = sortOrder;

    const tasks = await this.prisma.taskAssignment.findMany({
      where,
      skip,
      take: limit,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, profilePictureURL: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy,
    });

    return {
      tasks,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.taskAssignment.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, profilePictureURL: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, profilePictureURL: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    // Check if task exists
    await this.findOne(id);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === TaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      } else if (dto.status === TaskStatus.TODO) {
        updateData.progress = 0;
      }
    }
    if (dto.progress !== undefined) updateData.progress = dto.progress;
    if (dto.dueDate !== undefined) {
      updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.assigneeId !== undefined) {
      // Verify new assignee exists
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!assignee) {
        throw new NotFoundException('Assignee user not found');
      }
      updateData.assigneeId = dto.assigneeId;
    }

    const updated = await this.prisma.taskAssignment.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, profilePictureURL: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Notify assignee if task was reassigned
    if (dto.assigneeId !== undefined && updated.assigneeId) {
      this.chatGateway.sendNotificationToUser(
        updated.assigneeId,
        'Task Reassigned 📋',
        `"${updated.title}" has been assigned to you.`,
        { taskId: updated.id }
      );
    } else if (dto.status !== undefined || dto.progress !== undefined) {
      // Notify creator of status/progress update
      if (updated.creatorId && updated.creatorId !== updated.assigneeId) {
        const assigneeName = updated.assignee?.name || updated.assignee?.email || 'A teammate';
        this.chatGateway.sendNotificationToUser(
          updated.creatorId,
          'Task Progress Updated 📈',
          `"${updated.title}" is now "${updated.status}" (${updated.progress}%) - updated by ${assigneeName}.`,
          { taskId: updated.id }
        );
      }
    }

    return updated;
  }

  async deleteTask(id: string) {
    await this.findOne(id);
    await this.prisma.taskAssignment.delete({ where: { id } });
    return { success: true };
  }

  async addComment(taskId: string, authorId: string, dto: CreateCommentDto) {
    await this.findOne(taskId);

    return this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        content: dto.content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, profilePictureURL: true },
        },
      },
    });
  }
}
