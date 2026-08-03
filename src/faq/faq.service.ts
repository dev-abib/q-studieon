import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { GetAllFaqsDto } from './dto/get-all-faqs.dto';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async createFaq(dto: CreateFaqDto, file: MulterFile) {
    // Check for duplicate title
    const existing = await this.prisma.faq.findFirst({
      where: { title: dto.title },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A FAQ with this title already exists');
    }

    // Upload the FAQ image to Cloudinary
    const uploadResult = await this.cloudinary.uploadFile(file, 'faqs');

    const faq = await this.prisma.faq.create({
      data: {
        title: dto.title,
        description: dto.description,
        image: uploadResult.url,
        imagePublicId: uploadResult.publicId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return {
      message: 'FAQ created successfully',
      data: { faq },
    };
  }

  async getAllFaqs(dto: GetAllFaqsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = dto;

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Default ordering: sortOrder ascending (display order in the app),
    // with createdAt ascending as a stable tiebreaker for equal positions
    const orderBy = [
      { [sortBy]: sortOrder },
      ...(sortBy !== 'createdAt' ? [{ createdAt: 'asc' as const }] : []),
    ];

    const [total, faqs] = await Promise.all([
      this.prisma.faq.count({ where }),
      this.prisma.faq.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Successfully retrieved all FAQs',
      data: {
        faqs,
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

  async getFaqById(id: string) {
    const faq = await this.prisma.faq.findUnique({
      where: { id },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return {
      message: 'FAQ retrieved successfully',
      data: { faq },
    };
  }

  async updateFaq(id: string, dto: UpdateFaqDto, file?: MulterFile) {
    const existing = await this.prisma.faq.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('FAQ not found');
    }

    const hasBodyField = Object.values(dto).some(
      (value) => value !== undefined && value !== null && value !== '',
    );

    if (!hasBodyField && !file) {
      throw new BadRequestException(
        'At least one field or an image must be provided',
      );
    }

    // If title is being changed, check for duplicates
    if (dto.title && dto.title !== existing.title) {
      const duplicate = await this.prisma.faq.findFirst({
        where: { title: dto.title, id: { not: id } },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('A FAQ with this title already exists');
      }
    }

    // Build update data
    const data: Record<string, unknown> = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    };

    // Handle image: file upload takes priority
    if (file) {
      // Delete old image from Cloudinary if it exists
      if (existing.imagePublicId) {
        await this.cloudinary.deleteFile(existing.imagePublicId).catch(() => {
          // Silently ignore if the old image can't be deleted
        });
      }

      const uploadResult = await this.cloudinary.uploadFile(file, 'faqs');
      data.image = uploadResult.url;
      data.imagePublicId = uploadResult.publicId;
    }

    const faq = await this.prisma.faq.update({
      where: { id },
      data,
    });

    return {
      message: 'FAQ updated successfully',
      data: { faq },
    };
  }

  async deleteFaq(id: string) {
    const existing = await this.prisma.faq.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('FAQ not found');
    }

    // Delete image from Cloudinary if it exists
    if (existing.imagePublicId) {
      await this.cloudinary.deleteFile(existing.imagePublicId).catch(() => {
        // Silently ignore if image deletion fails
      });
    }

    await this.prisma.faq.delete({
      where: { id },
    });

    return {
      message: 'FAQ deleted successfully',
    };
  }
}
