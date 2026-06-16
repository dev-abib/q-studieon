import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { GetAllQuestionsDto } from './dto/get-all-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // helper: slugify a string
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // create question service
  async createQuestion(dto: CreateQuestionDto) {
    const slug = dto.slug ?? this.slugify(dto.text);

    const question = await this.prisma.question.create({
      data: {
        text: dto.text,
        slug,
        options: dto.options,
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

  // get questions by slug service (returns ALL questions with that slug)
  async getQuestionsBySlug(slug: string) {
    const questions = await this.prisma.question.findMany({
      where: { slug },
      orderBy: { createdAt: 'asc' },
    });

    return {
      message: 'Questions retrieved successfully',
      data: {
        questions,
      },
    };
  }

  // get all questions with pagination service
  async getAllQuestions(dto: GetAllQuestionsDto) {
    const {
      page = 1,
      limit = 6,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { text: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, questions] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
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

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.options !== undefined && { options: dto.options }),
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
