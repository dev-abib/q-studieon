import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { CreateInsightDto } from './dto/create-insight.dto';
import { UpdateInsightDto } from './dto/update-insight.dto';
import { GetAllInsightsDto } from './dto/get-all-insights.dto';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

@Injectable()
export class InsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async createInsight(dto: CreateInsightDto, file?: MulterFile) {
    // Check for duplicate title
    const existing = await this.prisma.insight.findFirst({
      where: { title: dto.title },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('An insight with this title already exists');
    }

    let iconUrl: string | null = null;
    let iconPublicId: string | null = null;

    // If a file was uploaded, upload to Cloudinary
    if (file) {
      const uploadResult = await this.cloudinary.uploadFile(file, 'insights');
      iconUrl = uploadResult.url;
      iconPublicId = uploadResult.publicId;
    }

    const insight = await this.prisma.insight.create({
      data: {
        icon: iconUrl,
        iconPublicId,
        title: dto.title,
        subTitle: dto.subTitle,
        description: dto.description,
        redirectLink: dto.redirectLink ?? null,
      },
    });

    return {
      message: 'Insight created successfully',
      data: { insight },
    };
  }

  async getAllInsights(dto: GetAllInsightsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { subTitle: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const orderBy = {
      [sortBy]: sortOrder,
    };

    const [total, insights] = await Promise.all([
      this.prisma.insight.count({ where }),
      this.prisma.insight.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Successfully retrieved all insights',
      data: {
        insights,
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

  async getInsightById(id: string) {
    const insight = await this.prisma.insight.findUnique({
      where: { id },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    return {
      message: 'Insight retrieved successfully',
      data: { insight },
    };
  }

  async updateInsight(id: string, dto: UpdateInsightDto, file?: MulterFile) {
    const existing = await this.prisma.insight.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Insight not found');
    }

    // If title is being changed, check for duplicates
    if (dto.title && dto.title !== existing.title) {
      const duplicate = await this.prisma.insight.findFirst({
        where: { title: dto.title, id: { not: id } },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException(
          'An insight with this title already exists',
        );
      }
    }

    // Build update data
    const data: Record<string, unknown> = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.subTitle !== undefined && { subTitle: dto.subTitle }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.redirectLink !== undefined && {
        redirectLink: dto.redirectLink,
      }),
    };

    // Handle icon: file upload takes priority
    if (file) {
      // Delete old icon from Cloudinary if it exists
      if (existing.iconPublicId) {
        await this.cloudinary.deleteFile(existing.iconPublicId).catch(() => {
          // Silently ignore if the old icon can't be deleted
        });
      }

      const uploadResult = await this.cloudinary.uploadFile(file, 'insights');
      data.icon = uploadResult.url;
      data.iconPublicId = uploadResult.publicId;
    }

    const insight = await this.prisma.insight.update({
      where: { id },
      data,
    });

    return {
      message: 'Insight updated successfully',
      data: { insight },
    };
  }

  async deleteInsight(id: string) {
    const existing = await this.prisma.insight.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Insight not found');
    }

    // Delete icon from Cloudinary if it exists
    if (existing.iconPublicId) {
      await this.cloudinary.deleteFile(existing.iconPublicId).catch(() => {
        // Silently ignore if icon deletion fails
      });
    }

    await this.prisma.insight.delete({
      where: { id },
    });

    return {
      message: 'Insight deleted successfully',
    };
  }
}
