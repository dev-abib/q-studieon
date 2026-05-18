import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDynamicPageDto } from './dto/create-dynamic-page.dto';
import { UpdateDynamicPageDto } from './dto/update-dynamic-page.dto';

@Injectable()
export class DynamicPageService {
  constructor(private readonly prisma: PrismaService) {}

  // create dynamic page service
  async createDynamicPage(dto: CreateDynamicPageDto) {
    let page = await this.prisma.dynamicPage.findUnique({
      where: { slug: dto.slug },
    });

    if (page) {
      return new ConflictException('This page already exists');
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
      return new NotFoundException('Page not found');
    }

    return {
      message: `Dynamic page retrieved successfully`,
      data: {
        page,
      },
    };
  }

  // get all dynamic page service
  async getAllDynamicPage() {
    const pages = await this.prisma.dynamicPage.findMany();

    if (pages.length < 1) {
      return new NotFoundException('Currently there is no dynamic page');
    }

    return {
      message: `Successfully retrieved all dynamic pages`,
      data: {
        pages,
      },
    };
  }

  // update dynamic page service
  // get dynamic page by slug service
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
      return new NotFoundException('Page not found');
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
