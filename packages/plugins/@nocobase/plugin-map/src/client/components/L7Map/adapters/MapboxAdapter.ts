/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Mapbox } from '@antv/l7';
import { BaseMapAdapter } from './BaseMapAdapter';
import { MapOptions } from './types';

/**
 * Mapbox adapter using L7
 */
export class MapboxAdapter extends BaseMapAdapter {
  type = 'mapbox' as const;
  private map: any = null;

  async createMap(options: MapOptions): Promise<any> {
    const { container, center, zoom, pitch = 0, accessKey } = options;

    if (!accessKey) {
      throw new Error('Mapbox access token is required');
    }

    // Create Mapbox instance WITHOUT container - Scene will handle the container binding
    this.mapInstance = new Mapbox({
      token: accessKey,
      style: 'mapbox://styles/mapbox/streets-v11',
      center,
      zoom,
      pitch,
    });

    // Return the Mapbox instance directly - Scene will handle initialization
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
    if (this.map) {
      this.map.fitBounds(bounds, options);
    }
  }

  getMapStyle(): string {
    return 'mapbox://styles/mapbox/streets-v11';
  }

  destroy(): void {
    this.map = null;
    super.destroy();
  }
}
