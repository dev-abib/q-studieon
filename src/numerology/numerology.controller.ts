import { Body, Controller, Post } from '@nestjs/common';
import { AddressDto } from './dto/numerlogoy.dto';
import { NumerologyService } from './numerology.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('numerology')
export class NumerologyController {
  constructor(private readonly numerology: NumerologyService) {}

  @Post('create-report')
  @Public()
  createReport(@Body() dto: AddressDto) {
    return this.numerology.createReport(dto);
  }
}
