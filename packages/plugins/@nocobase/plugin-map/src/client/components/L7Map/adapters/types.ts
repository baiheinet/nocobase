/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type MapType = 'mapbox' | 'amap' | 'google';

export interface MapOptions {
  container: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  accessKey?: string;
  securityJsCode?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  location: [number, number];
  address?: string;
}

/**
 * Base map adapter interface
 * All map providers should implement this interface
 */
export interface IMapAdapter {
  type: MapType;

  /**
   * Create and initialize the base map
   */
  createMap(options: MapOptions): Promise<any>;

  /**
   * Set map center
   */
  setCenter(lngLat: [number, number]): void;

  /**
   * Set map zoom level
   */
  setZoom(zoom: number): void;

  /**
   * Fit map to bounds
   */
  fitBounds(bounds: [[number, number], [number, number]], options?: any): void;

  /**
   * Get map instance
   */
  getMapInstance(): any;

  /**
   * Destroy the map
   */
  destroy(): void;

  /**
   * Search POI (optional, not all maps support)
   */
  searchPOI?(keyword: string, city?: string): Promise<SearchResult[]>;

  /**
   * Get map style/configuration
   */
  getMapStyle?(): string;
}
