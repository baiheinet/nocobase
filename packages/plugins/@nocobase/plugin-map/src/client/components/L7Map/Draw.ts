/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/* eslint-disable prettier/prettier */
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useEffect, useRef } from 'react';
import { useMemoizedFn } from 'ahooks';
import { Scene } from '@antv/l7';
import { MapEditorType } from '../../types';

/**
 * Unified L7 draw hook (renamed from useL7Draw to Draw for consistency)
 */
export const Draw = (
  scene: Scene,
  type: MapEditorType,
  value: any,
  onChange?: (value: any) => void,
  disabled?: boolean,
) => {
  const drawRef = useRef<any>(null);

  // Stable onChange callback
  const onMapChange = useMemoizedFn((nextValue) => {
    onChange?.(nextValue);
  });

  // Initialize draw tools and handle interactions
  useEffect(() => {
    if (!scene) return;

    // Disabled mode: no interaction
    if (disabled) return;
    (async () => {
      try {
        const mod: any = await import('@antv/l7-draw');
        let DrawCls: any = null;
        if (type === 'point') DrawCls = mod.DrawPoint;
        else if (type === 'lineString') DrawCls = mod.DrawLine;
        else if (type === 'polygon') DrawCls = mod.DrawPolygon;
        else if (type === 'circle') DrawCls = mod.DrawCircle;
        if (!DrawCls) return;

        const draw = new DrawCls(scene, {
          editable: true,
          clickEnable: true,
        });
        drawRef.current = draw;

        if (!value) {
          // Draw new feature

          const addHandler = (feature: any) => {
            if (!feature?.geometry) return;
            let next: any = null;
            if (type === 'point') {
              const coords = feature.geometry.coordinates || [];
              if (coords.length >= 2) next = [coords[0], coords[1]];
            } else if (type === 'lineString') {
              next = feature.geometry.coordinates;
            } else if (type === 'polygon') {
              let ring = feature.geometry.coordinates?.[0] || [];
              if (ring.length > 1) {
                const first = ring[0];
                const last = ring[ring.length - 1];
                if (first[0] === last[0] && first[1] === last[1]) ring = ring.slice(0, -1);
              }
              next = ring;
            } else if (type === 'circle') {
              const center = feature.properties?.center;
              const radius = feature.properties?.radius;
              if (center && radius != null) {
                next = [center[0], center[1], radius];
              }
            }
            if (next) {
              onMapChange(next);
              draw.disable();
            }
          };

          // 先注册事件监听器，再启用绘制工具
          draw.on('add', addHandler);

          draw.enable();
        } else {
          // Edit existing feature
          // Point: click to relocate (Map will render the overlay)
          if (type === 'point') {
            draw.enable();
            const addHandler = (feature: any) => {
              if (!feature?.geometry) return;
              const coords = feature.geometry.coordinates || [];
              if (coords.length >= 2) {
                const next = [coords[0], coords[1]];
                onMapChange(next);
                draw.disable();
              }
            };
            draw.on('add', addHandler);
            return;
          }

          // Convert to GeoJSON for editing (Map will render the overlay)
          let geoJsonFeature: any = null;
          if (type === 'lineString') {
            geoJsonFeature = {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: value },
              properties: {},
            };
          } else if (type === 'polygon') {
            const coords = (value as [number, number][]).slice();
            if (coords.length) {
              const first = coords[0];
              const last = coords[coords.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
            }
            geoJsonFeature = {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [coords] },
              properties: {},
            };
          } else if (type === 'circle') {
            const [lng, lat, radius] = value;
            geoJsonFeature = {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: { center: [lng, lat], radius },
            };
          }

          if (geoJsonFeature) {
            draw.setData({ type: 'FeatureCollection', features: [geoJsonFeature] });
            draw.enable();

            const editHandler = (feature: any) => {
              if (!feature?.geometry) return;
              let next: any = null;
              if (type === 'lineString') {
                next = feature.geometry.coordinates;
              } else if (type === 'polygon') {
                let ring = feature.geometry.coordinates?.[0] || [];
                if (ring.length > 1) {
                  const first = ring[0];
                  const last = ring[ring.length - 1];
                  if (first[0] === last[0] && first[1] === last[1]) ring = ring.slice(0, -1);
                }
                next = ring;
              } else if (type === 'circle') {
                const center = feature.properties?.center;
                const radius = feature.properties?.radius;
                if (center && radius != null) {
                  next = [center[0], center[1], radius];
                }
              }
              if (next) {
                onMapChange(next);
              }
            };
            draw.on('edit', editHandler);
          }
        }
      } catch (e) {
        // ignore if l7-draw is not available
      }
    })();

    return () => {
      try {
        drawRef.current?.disable();
        drawRef.current?.destroy();
      } catch {
        // ignore cleanup errors
      }
      drawRef.current = null;
    };
  }, [scene, value, type, disabled, onMapChange]);

  return;
};
