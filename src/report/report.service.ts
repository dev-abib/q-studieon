import { Injectable } from '@nestjs/common';

import { PlaceDetailsHelper } from 'src/auth/helpers/place-details.helper';
import { NumerologyHelpers } from 'src/auth/helpers/numerology-helpers';
import { AiHelper, ReportAccessLevel } from 'src/auth/helpers/ai-helper';

import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
  constructor(
    private readonly placeDetailsHelper: PlaceDetailsHelper,
    private readonly numerologyHelpers: NumerologyHelpers,
    private readonly aiHelper: AiHelper,
  ) {}

  async createReport(dto: CreateReportDto) {
    const placeDetails = await this.placeDetailsHelper.getPlacePhotos({
      lat: dto.latitude,
      lng: dto.longitude,
    });

    const photosDetails = {
      placeId: placeDetails?.[0]?.place_id ?? null,
      photos: [
        placeDetails?.[0]?.photos?.[0],
        placeDetails?.[0]?.photos?.[1],
      ].filter(Boolean),
    };

    const numerologyDetails = this.numerologyHelpers.createReport(dto);

    const aiResponse = await this.aiHelper.generateByAccessLevel(
      ReportAccessLevel.PAID_FULL,
      {
        address: dto.address,
        numerologyDetails,
        entranceBearing: dto.entranceDegrees,
        userConfirmedDirection: true,
      },
    );

    return {
      message: 'Home alignment report generated successfully',
      data: {
        photosDetails,
        report: aiResponse.data,
        metadata: aiResponse.metadata,
      },
    };
  }
}
