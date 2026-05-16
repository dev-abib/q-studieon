import { Body, Controller, Post } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { DynamicPageService } from './dynamic-page.service';
import { CreateDynamicPageDto } from './dto/create-dynamic-page.dto';

@Controller('dynamic-page')
export class DynamicPageController {
  constructor(private readonly dynamicPageService: DynamicPageService) {}

  // create dynamic page controller
  @Post('create')
  @Auth('admin')
  createDynamicPage(@Body() dto: CreateDynamicPageDto) {
    return this.dynamicPageService.createDynamicPage(dto);
  }
}
