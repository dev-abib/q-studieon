import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetAllCategoriesDto } from './dto/get-all-categories.dto';
import { createFileUploadInterceptor } from '../common/interceptors/file-upload.interceptor';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // create category controller
  @Post('create-category')
  @Auth('admin')
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'icon' }))
  @ApiOperation({ summary: 'Create a new category (multipart: name + optional icon file)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Category creation payload',
    required: true,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Favorite Color' },
        icon: { type: 'string', format: 'binary', description: 'Category icon image' },
      },
    },
  })
  createCategory(
    @UploadedFile(new FileValidationPipe({ required: false })) file: MulterFile | undefined,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory(dto, file);
  }

  // get all categories controller
  @Get('get-all-categories')
  @Auth('admin')
  @ApiOperation({ summary: 'Get all categories with pagination' })
  getAllCategories(@Query() dto: GetAllCategoriesDto) {
    return this.categoryService.getAllCategories(dto);
  }

  // get category by ID controller
  @Get(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  getCategoryById(@Param('id') id: string) {
    return this.categoryService.getCategoryById(id);
  }

  // update category by ID controller
  @Put(':id')
  @Auth('admin')
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'icon' }))
  @ApiOperation({ summary: 'Update a category (multipart: optional name + optional icon file)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Category update payload',
    required: true,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Favorite Color' },
        icon: { type: 'string', format: 'binary', description: 'Category icon image' },
      },
    },
  })
  updateCategoryById(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe({ required: false })) file: MulterFile | undefined,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategoryById(id, dto, file);
  }

  // delete category by ID controller
  @Delete(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Delete a category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  deleteCategoryById(@Param('id') id: string) {
    return this.categoryService.deleteCategoryById(id);
  }
}
