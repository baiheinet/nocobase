/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Map } from '@antv/l7';
import { BaseMapAdapter } from './BaseMapAdapter';
import { MapOptions, SearchResult } from './types';
import { Loader } from '@googlemaps/js-api-loader';

/**
 * Google Maps adapter using L7
 */
export class GoogleAdapter extends BaseMapAdapter {
  type = 'google' as const;
  private googleMaps: typeof google.maps | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private map: any = null;

  async createMap(options: MapOptions): Promise<any> {
    const { container, center, zoom, accessKey } = options;

    if (!accessKey) {
      throw new Error('Google Maps API key is required');
    }

    // Load Google Maps API
    const loader = new Loader({
      apiKey: accessKey,
      version: 'weekly',
      libraries: ['places'],
    });

    await loader.load();
    this.googleMaps = google.maps;

    // Create a native Google Map instance first
    const googleMapInstance = new google.maps.Map(document.createElement('div'), {
      center: { lat: center[1], lng: center[0] },
      zoom,
    });

    // Initialize places service
    this.placesService = new google.maps.places.PlacesService(googleMapInstance);

    // Create L7 Map with Google Maps - it will be used directly in Scene
    this.mapInstance = new Map({
      container,
      style: 'blank',
      center,
      zoom,
      maxZoom: 20,
    });

    // Return the Map instance directly - Scene will handle initialization
    // Store map reference after a short delay (map loads asynchronously)
    setTimeout(() => {
      if (this.mapInstance && this.mapInstance.map) {
        this.map = this.mapInstance.map;
      }
    }, 100);

    return this.mapInstance;
  }

  setCenter(lngLat: [number, number]): void {
    if (this.map) {
      this.map.setCenter(lngLat);
    }
  }

  setZoom(zoom: number): void {
    if (this.map) {
      this.map.setZoom(zoom);
    }
  }

  fitBounds(bounds: [[number, number], [number, number]], options?: any): void {
    if (this.map && this.googleMaps) {
      // Convert to Google Maps LatLngBounds format
      const googleBounds = new this.googleMaps.LatLngBounds(
        { lat: bounds[0][1], lng: bounds[0][0] }, // southwest
        { lat: bounds[1][1], lng: bounds[1][0] }, // northeast
      );
      this.map.fitBounds(googleBounds, options);
    }
  }

  async searchPOI(keyword: string): Promise<SearchResult[]> {
    if (!this.placesService || !this.googleMaps) {
      return [];
    }

    return new Promise((resolve) => {
      const request: google.maps.places.TextSearchRequest = {
        query: keyword,
      };

      this.placesService!.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const searchResults: SearchResult[] = results.map((place) => ({
            id: place.place_id || '',
            name: place.name || '',
            location: [place.geometry?.location?.lng() || 0, place.geometry?.location?.lat() || 0],
            address: place.formatted_address,
          }));
          resolve(searchResults);
        } else {
          resolve([]);
        }
      });
    });
  }

  getMapStyle(): string {
    return 'blank';
  }

  destroy(): void {
    this.map = null;
    this.googleMaps = null;
    this.placesService = null;
    super.destroy();
  }
}
