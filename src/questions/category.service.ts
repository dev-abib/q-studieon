import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetAllCategoriesDto } from './dto/get-all-categories.dto';
import { MulterFile } from '../common/pipes/file-validation.pipe';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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

  // create category service
  async createCategory(dto: CreateCategoryDto, file?: MulterFile) {
    // Check for duplicate name
    const slug = this.slugify(dto.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Category with name "${dto.name}" already exists`);
    }

    let iconUrl: string | null = dto.icon ?? null;
    let iconPublicId: string | null = null;

    // If a file was uploaded, upload to Cloudinary
    if (file) {
      const uploadResult = await this.cloudinary.uploadFile(file, 'categories');
      iconUrl = uploadResult.url;
      iconPublicId = uploadResult.publicId;
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        icon: iconUrl,
        iconPublicId,
      },
    });

    return {
      message: 'Category created successfully',
      data: { category },
    };
  }

  // get category by ID service
  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      message: 'Category retrieved successfully',
      data: { category },
    };
  }

  // get all categories with pagination service
  async getAllCategories(dto: GetAllCategoriesDto) {
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
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: { _count: { select: { questions: true } } },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: 'Successfully retrieved all categories',
      data: {
        categories,
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

  // update category by ID service
  async updateCategoryById(id: string, dto: UpdateCategoryDto, file?: MulterFile) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    // Build update data
    const updateData: any = {};

    if (dto.name !== undefined) {
      const newSlug = this.slugify(dto.name);

      // Check for duplicate slug (excluding current category)
      const duplicate = await this.prisma.category.findFirst({
        where: { slug: newSlug, id: { not: id } },
      });

      if (duplicate) {
        throw new ConflictException(`Category with name "${dto.name}" already exists`);
      }

      updateData.name = dto.name;
      updateData.slug = newSlug;
    }

    // If a file was uploaded, upload to Cloudinary and update icon
    if (file) {
      // Delete old icon from Cloudinary if it exists
      if (existing.iconPublicId) {
        await this.cloudinary.deleteFile(existing.iconPublicId).catch(() => {
          // Silently ignore if the old icon can't be deleted
        });
      }

      const uploadResult = await this.cloudinary.uploadFile(file, 'categories');
      updateData.icon = uploadResult.url;
      updateData.iconPublicId = uploadResult.publicId;
    } else if (dto.icon !== undefined) {
      // If icon URL is provided directly (not file upload), clear the publicId
      updateData.icon = dto.icon;
      updateData.iconPublicId = null;
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    return {
      message: 'Category updated successfully',
      data: { category },
    };
  }

  // delete category by ID service
  async deleteCategoryById(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (existing._count.questions > 0) {
      throw new ConflictException(
        `Cannot delete category "${existing.name}" because it has ${existing._count.questions} question(s) linked to it. Remove or reassign them first.`,
      );
    }

    // Delete icon from Cloudinary if it exists
    if (existing.iconPublicId) {
      await this.cloudinary.deleteFile(existing.iconPublicId).catch(() => {
        // Silently ignore if icon deletion fails
      });
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return {
      message: 'Category deleted successfully',
    };
  }


}
