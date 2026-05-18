import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { DynamicPageService } from './dynamic-page.service';
import { CreateDynamicPageDto } from './dto/create-dynamic-page.dto';
import { UpdateDynamicPageDto } from './dto/update-dynamic-page.dto';

@Controller('dynamic-page')
export class DynamicPageController {
  constructor(private readonly dynamicPageService: DynamicPageService) {}

  // create dynamic page controller
  @Post('create-page')
  @Auth('admin')
  createDynamicPage(@Body() dto: CreateDynamicPageDto) {
    return this.dynamicPageService.createDynamicPage(dto);
  }

  // get all dynamic pages controller
  @Get('get-all-pages')
  @Auth('admin')
  getAllDynamicPages() {
    return this.dynamicPageService.getAllDynamicPage();
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
