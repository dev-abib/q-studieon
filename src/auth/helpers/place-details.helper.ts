import { Injectable } from '@nestjs/common';
import {
  Client,
  PlaceDetailsResponse,
  PlacePhoto,
  PlacesNearbyResponse,
} from '@googlemaps/google-maps-services-js';

export interface PlacePhotoResult {
  url: string;
  width: number;
  height: number;
}

export interface PlaceResult {
  place_id: string;
  photos: PlacePhotoResult[];
}

@Injectable()
export class PlaceDetailsHelper {
  private client: Client;
  private apiKey: string;

  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY as string;
  }

  private buildPhotoUrl(photoReference: string, maxWidth = 1080): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  private async getPlacePhotosById(
    placeId: string,
    maxWidth = 1080,
  ): Promise<PlaceResult> {
    const response: PlaceDetailsResponse = await this.client.placeDetails({
      params: {
        place_id: placeId,
        fields: ['photos'],
        key: this.apiKey,
      },
    });

    const photos = (response.data.result.photos ?? []).map(
      (photo: PlacePhoto) => ({
        url: this.buildPhotoUrl(photo.photo_reference, maxWidth),
        width: photo.width,
        height: photo.height,
      }),
    );

    return { place_id: placeId, photos };
  }

  async getPlacePhotos(
    latlng: { lat: number; lng: number },
    maxWidth = 800,
  ): Promise<PlaceResult[]> {
    const raw: unknown = await this.client.placesNearby({
      params: {
        location: { lat: latlng.lat, lng: latlng.lng },
        radius: 100,
        type: 'point_of_interest',
        key: this.apiKey,
      },
    });

    const response = raw as PlacesNearbyResponse;
    const places = response.data.results;
    if (!places || places.length === 0) return [];

    const results = await Promise.all(
      places
        .slice(0, 5)
        .map((place) =>
          this.getPlacePhotosById(place.place_id as string, maxWidth),
        ),
    );

    // Return only places that actually have photos
    return results.filter((r) => r.photos.length > 0);
  }
}
