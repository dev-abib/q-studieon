import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { DynamicPageService } from './dynamic-page.service';
import { CreateDynamicPageDto } from './dto/create-dynamic-page.dto';
import { UpdateDynamicPageDto } from './dto/update-dynamic-page.dto';
import { GetAllDynamicPagesDto } from './dto/get-all-page.dto';

@ApiTags('Dynamic Pages')
@ApiBearerAuth()
@Controller('dynamic-page')
export class DynamicPageController {
  constructor(private readonly dynamicPageService: DynamicPageService) {}

  // create dynamic page controller
  @Post('create-page')
  @Auth('admin')
  @ApiOperation({ summary: 'Create a new dynamic page' })
  createDynamicPage(@Body() dto: CreateDynamicPageDto) {
    return this.dynamicPageService.createDynamicPage(dto);
  }

  @Get('get-all-pages')
  @Auth('admin')
  @ApiOperation({ summary: 'Get all dynamic pages with pagination' })
  getAllDynamicPages(@Query() dto: GetAllDynamicPagesDto) {
    return this.dynamicPageService.getAllDynamicPage(dto);
  }

  // get dynamic page by slug controller
  @Get('/:slug')
  @Auth('admin')
  @ApiOperation({ summary: 'Get a dynamic page by slug' })
  getPageBySlug(@Param('slug') slug: string) {
    return this.dynamicPageService.getDynamicPageBySlug(slug);
  }

  // delete dynamic page by slug controller
  @Delete('/delete/:slug')
  @Auth('admin')
  @ApiOperation({ summary: 'Delete a dynamic page by slug' })
  deletePageBySlug(@Param('slug') slug: string) {
    return this.dynamicPageService.deleteDynamicPage(slug);
  }

  // update dynamic page by slug controller
  @Put('/update/:slug')
  @Auth('admin')
  @ApiOperation({ summary: 'Update a dynamic page by slug' })
  updatePageBySlug(
    @Param('slug') slug: string,
    @Body() dto: UpdateDynamicPageDto,
  ) {
    return this.dynamicPageService.updateDynamicPageBySlug(slug, dto);
  }
}
