import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { GetAllQuestionsDto } from './dto/get-all-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // create question service
  async createQuestion(dto: CreateQuestionDto) {
    let question = await this.prisma.question.findUnique({
      where: { slug: dto.slug },
    });

    if (question) {
      throw new ConflictException('A question with this slug already exists');
    }

    question = await this.prisma.question.create({
      data: {
        text: dto.text,
        slug: dto.slug,
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

  // get question by slug service
  async getQuestionBySlug(slug: string) {
    const question = await this.prisma.question.findUnique({
      where: { slug },
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

    if (total === 0) {
      throw new NotFoundException('No questions found');
    }

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

  // update question by slug service
  async updateQuestionBySlug(slug: string, dto: UpdateQuestionDto) {
    // Check if question exists
    const existing = await this.prisma.question.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    // If slug is being changed, check for conflicts
    if (dto.slug && dto.slug !== slug) {
      const slugConflict = await this.prisma.question.findUnique({
        where: { slug: dto.slug },
      });
      if (slugConflict) {
        throw new ConflictException('A question with this slug already exists');
      }
    }

    const question = await this.prisma.question.update({
      where: { slug },
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

  // delete question by slug service
  async deleteQuestion(slug: string) {
    const existing = await this.prisma.question.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    await this.prisma.question.delete({
      where: { slug },
    });

    return {
      message: 'Question deleted successfully',
    };
  }
}
