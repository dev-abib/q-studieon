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
import { Auth } from '../auth/decorators/auth.decorator';
import { DynamicPageService } from './dynamic-page.service';
import { CreateDynamicPageDto } from './dto/create-dynamic-page.dto';
import { UpdateDynamicPageDto } from './dto/update-dynamic-page.dto';
import { GetAllDynamicPagesDto } from './dto/get-all-page.dto';

@Controller('dynamic-page')
export class DynamicPageController {
  constructor(private readonly dynamicPageService: DynamicPageService) {}

  // create dynamic page controller
  @Post('create-page')
  @Auth('admin')
  createDynamicPage(@Body() dto: CreateDynamicPageDto) {
    return this.dynamicPageService.createDynamicPage(dto);
  }

  @Get('get-all-pages')
  @Auth('admin')
  getAllDynamicPages(@Query() dto: GetAllDynamicPagesDto) {
    return this.dynamicPageService.getAllDynamicPage(dto);
  }

  // get dynamic page by slug controller
  @Get('/:slug')
  @Auth('admin')
  getPageBySlug(@Param('slug') slug: string) {
    return this.dynamicPageService.getDynamicPageBySlug(slug);
  }

  // delete dynamic page by slug controller
  @Delete('/delete/:slug')
  @Auth('admin')
  deletePageBySlug(@Param('slug') slug: string) {
    return this.dynamicPageService.deleteDynamicPage(slug);
  }

  // delete dynamic page by slug controller
  @Put('/update/:slug')
  @Auth('admin')
  updatePageBySlug(
    @Param('slug') slug: string,
    @Body() dto: UpdateDynamicPageDto,
  ) {
    return this.dynamicPageService.updateDynamicPageBySlug(slug, dto);
  }
}
