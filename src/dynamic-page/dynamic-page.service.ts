import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDynamicPageDto } from './dto/create-dynamic-page.dto';
import { UpdateDynamicPageDto } from './dto/update-dynamic-page.dto';
import { GetAllDynamicPagesDto } from './dto/get-all-page.dto';

@Injectable()
export class DynamicPageService {
  constructor(private readonly prisma: PrismaService) {}

  // create dynamic page service
  async createDynamicPage(dto: CreateDynamicPageDto) {
    let page = await this.prisma.dynamicPage.findUnique({
      where: { slug: dto.slug },
    });

    if (page) {
      throw new ConflictException('This page already exists');
    }

    page = await this.prisma.dynamicPage.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
      },
    });

    return {
      message: `Dynamic page created successfully`,
      data: {
        page,
      },
    };
  }

  // get dynamic page by slug service
  async getDynamicPageBySlug(slug: string) {
    const page = await this.prisma.dynamicPage.findUnique({
      where: { slug: slug },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return {
      message: `Dynamic page retrieved successfully`,
      data: {
        page,
      },
    };
  }

  async getAllDynamicPage(dto: GetAllDynamicPagesDto) {
    const {
      page = 1,
      limit = 6,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;

    const skip = (page - 1) * limit;

    // Build search filter (matches title OR slug)
    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Run count + paginated fetch in parallel
    const [total, pages] = await Promise.all([
      this.prisma.dynamicPage.count({ where }),
      this.prisma.dynamicPage.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    if (total === 0) {
      throw new NotFoundException('No dynamic pages found');
    }

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Successfully retrieved all dynamic pages',
      data: {
        pages,
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

  // update dynamic page service
  async updateDynamicPageBySlug(slug: string, dto: UpdateDynamicPageDto) {
    const page = await this.prisma.dynamicPage.update({
      where: { slug: slug },
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return {
      message: `Dynamic page updated successfully`,
      data: {
        page,
      },
    };
  }

  // delete dynamic page service
  async deleteDynamicPage(slug: string) {
    const page = await this.prisma.dynamicPage.delete({
      where: { slug: slug },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return {
      message: `Page deleted successfully`,
    };
  }
}
