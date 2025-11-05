/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { IMapAdapter, MapType } from './types';
import { MapboxAdapter } from './MapboxAdapter';
import { GaodeAdapter } from './GaodeAdapter';
import { GoogleAdapter } from './GoogleAdapter';

/**
 * Factory to create map adapters
 */
export class MapAdapterFactory {
  private static adapters: Record<MapType, new () => IMapAdapter> = {
    mapbox: MapboxAdapter,
    amap: GaodeAdapter,
    google: GoogleAdapter,
  };

  static create(type: MapType): IMapAdapter {
    const AdapterClass = this.adapters[type];
    if (!AdapterClass) {
      throw new Error(`Unsupported map type: ${type}`);
    }
    return new AdapterClass();
  }

  static register(type: MapType, adapter: new () => IMapAdapter) {
    this.adapters[type] = adapter;
  }

  static getSupportedTypes(): MapType[] {
    return Object.keys(this.adapters) as MapType[];
  }
}
