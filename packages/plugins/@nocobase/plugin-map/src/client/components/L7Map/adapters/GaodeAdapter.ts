/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { GaodeMap } from '@antv/l7';
import { BaseMapAdapter } from './BaseMapAdapter';
import { MapOptions, SearchResult } from './types';

/**
 * Gaode (AMap) adapter using L7
 */
export class GaodeAdapter extends BaseMapAdapter {
  type = 'amap' as const;
  private AMap: any = null;
  private map: any = null;

  async createMap(options: MapOptions): Promise<any> {
    const { container, center, zoom, pitch = 0, accessKey, securityJsCode } = options;

    if (!accessKey) {
      throw new Error('AMap access key is required');
    }

    // Set security code if provided
    if (securityJsCode) {
      (window as any)._AMapSecurityConfig = {
        securityJsCode,
      };
    }

    // Create GaodeMap instance - it will be used directly in Scene
    this.mapInstance = new GaodeMap({
      container,
      token: accessKey,
      style: 'normal',
      center,
      zoom,
      pitch,
    });

    // Return the GaodeMap instance directly - Scene will handle initialization
    // Store map reference after a short delay (map loads asynchronously)
    setTimeout(() => {
      if (this.mapInstance && this.mapInstance.map) {
        this.map = this.mapInstance.map;
      }
      // Store AMap instance for POI search and utilities
      if ((window as any).AMap) {
        this.AMap = (window as any).AMap;
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
    if (this.map && this.AMap) {
      // Convert bounds to AMap.Bounds format
      const amapBounds = new this.AMap.Bounds(
        [bounds[0][0], bounds[0][1]], // southwest
        [bounds[1][0], bounds[1][1]], // northeast
      );
      this.map.setBounds(amapBounds);
    }
  }

  async searchPOI(keyword: string, city?: string): Promise<SearchResult[]> {
    if (!this.AMap) {
      return [];
    }

    return new Promise((resolve) => {
      const placeSearch = new this.AMap.PlaceSearch({
        city: city || '全国',
      });

      placeSearch.search(keyword, (status: string, result: any) => {
        if (status === 'complete' && result.poiList?.pois) {
          const results: SearchResult[] = result.poiList.pois.map((poi: any) => ({
            id: poi.id,
            name: poi.name,
            location: [poi.location.lng, poi.location.lat],
            address: poi.address,
          }));
          resolve(results);
        } else {
          resolve([]);
        }
      });
    });
  }

  getMapStyle(): string {
    return 'normal';
  }

  destroy(): void {
    this.map = null;
    this.AMap = null;
    super.destroy();
  }
}
