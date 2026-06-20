import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { GetAllQuestionsDto } from './dto/get-all-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // create question service
  async createQuestion(dto: CreateQuestionDto) {
    // Verify the category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const question = await this.prisma.question.create({
      data: {
        text: dto.text,
        options: dto.options,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });

    return {
      message: 'Question created successfully',
      data: {
        question,
      },
    };
  }

  // get question by ID service
  async getQuestionById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return {
      message: 'Question retrieved successfully',
      data: {
        question,
      },
    };
  }

  // get all questions with pagination and optional category filter
  async getAllQuestions(dto: GetAllQuestionsDto) {
    const {
      page = 1,
      limit = 6,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      categoryId,
    } = dto;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [total, questions] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          category: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Successfully retrieved all questions',
      data: {
        questions,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasPrevPage: page > 1,
          hasNextPage: page < totalPages,
        },
      },
    };
  }

  // update question by ID service
  async updateQuestionById(id: string, dto: UpdateQuestionDto) {
    const existing = await this.prisma.question.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    // If categoryId is being updated, verify the category exists
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.options !== undefined && { options: dto.options }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: {
        category: true,
      },
    });

    return {
      message: 'Question updated successfully',
      data: {
        question,
      },
    };
  }

  // delete question by ID service
  async deleteQuestionById(id: string) {
    const existing = await this.prisma.question.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    await this.prisma.question.delete({
      where: { id },
    });

    return {
      message: 'Question deleted successfully',
    };
  }
}
