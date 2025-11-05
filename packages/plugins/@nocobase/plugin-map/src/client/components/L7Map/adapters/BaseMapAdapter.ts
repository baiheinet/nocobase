/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { IMapAdapter, MapOptions } from './types';

/**
 * Abstract base class for map adapters
 */
export abstract class BaseMapAdapter implements IMapAdapter {
  abstract type: 'mapbox' | 'amap' | 'google';
  protected mapInstance: any = null;

  abstract createMap(options: MapOptions): Promise<any>;

  abstract setCenter(lngLat: [number, number]): void;

  abstract setZoom(zoom: number): void;

  abstract fitBounds(bounds: [[number, number], [number, number]], options?: any): void;

  getMapInstance() {
    return this.mapInstance;
  }

  destroy() {
    if (this.mapInstance) {
      this.mapInstance = null;
    }
  }
}
