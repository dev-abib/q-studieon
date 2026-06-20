import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'System health check', description: 'Returns full system status including server info, database connectivity, and environment details' })
  async getSystemStatus() {
    const status = await this.appService.getSystemStatus();
    return {
      data: status,
      message: 'System health check',
    };
  }
}
