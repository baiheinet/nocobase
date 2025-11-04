/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Spin } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useFieldSchema } from '@formily/react';
import { css, useApp, useCollection_deprecated, useNavigateNoUpdate } from '@nocobase/client';
import { useMemoizedFn } from 'ahooks';
import { Scene, PointLayer, LineLayer, PolygonLayer, Mapbox } from '@antv/l7';
import type { ILayer } from '@antv/l7';
import { useMapConfiguration } from '../../hooks';
import { useMapTranslation } from '../../locale';
import { MapEditorType } from '../../types';
import { useMapHeight } from '../hook';

export interface MapboxComponentProps {
  value?: any;
  onChange?: (value: number[]) => void;
  disabled?: boolean;
  mapType: string;
  readonly: string;
  zoom: number;
  type: MapEditorType;
  style?: React.CSSProperties;
  overlayCommonOptions?: any;
  block?: boolean;
}

export interface MapboxForwardedRefProps {
  setOverlay: (t: MapEditorType, v: any, o?: any) => any;
  getOverlay: (t: MapEditorType, v: any, o?: any) => any;
  scene: Scene;
  layer: any;
  errMessage?: string;
}

export const MapboxComponent = React.forwardRef<MapboxForwardedRefProps, MapboxComponentProps>((props, ref) => {
  const { accessKey: accessToken } = useMapConfiguration(props.mapType) || {};
  const { value, onChange, block = false, readonly, disabled = block, zoom = 13 } = props;
  const { t } = useMapTranslation();
  const fieldSchema = useFieldSchema();
  const scene = useRef<Scene>();
  const layer = useRef<any>();
  const drawRef = useRef<any>();
  const [needUpdateFlag, forceUpdate] = useState([]);
  const [errMessage, setErrMessage] = useState('');
  const { getField } = useCollection_deprecated();
  const type = useMemo<MapEditorType>(() => {
    if (props.type) return props.type;
    const collectionField = getField(fieldSchema?.name);
    return collectionField?.interface;
  }, [props?.type, fieldSchema?.name]);

  const navigate = useNavigateNoUpdate();
  const id = useRef(`nocobase-map-mapbox-${type || ''}-${Date.now().toString(32)}`);
  const { modal } = App.useApp();
  const height = useMapHeight();

  useEffect(() => {
    if (scene.current) {
      scene.current.setZoom(zoom);
    }
  }, [zoom]);

  const toRemoveOverlay = useMemoizedFn(() => {
    if (layer.current) {
      scene.current?.removeLayer(layer.current);
      layer.current = null;
    }
  });

  const onMapChange = useMemoizedFn((nextValue) => {
    onChange?.(nextValue);
  });

  const onReset = () => {
    const ok = () => {
      toRemoveOverlay();
      onChange?.(null);
    };
    modal.confirm({
      title: t('Clear the canvas'),
      content: t('Are you sure to clear the canvas?'),
      okText: t('Confirm'),
      cancelText: t('Cancel'),
      getContainer: () => document.getElementById(id.current),
      onOk() {
        ok();
      },
    });
  };

  const onFocusOverlay = () => {
    if (layer.current && value) {
      // Focus by setting center roughly to the overlay center
      try {
        if (Array.isArray(value)) {
          if (type === 'point') {
            scene.current?.setCenter?.(value);
          } else if (type === 'circle') {
            scene.current?.setCenter?.(value.slice(0, 2));
          } else {
            const coords = value as [number, number][];
            if (coords?.length) {
              const cx = coords.reduce((s, p) => s + p[0], 0) / coords.length;
              const cy = coords.reduce((s, p) => s + p[1], 0) / coords.length;
              scene.current?.setCenter?.([cx, cy]);
            }
          }
        }
      } catch (e) {
        /* noop */
      }
    }
  };

  const circleToPolygon = (center: [number, number], radius: number, steps = 64) => {
    const [lng, lat] = center;
    const res: [number, number][] = [];
    const dLat = radius / 111320;
    const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      res.push([lng + Math.cos(theta) * dLng, lat + Math.sin(theta) * dLat]);
    }
    res.push(res[0]);
    return res;
  };

  const getOverlay = useCallback(
    (t = type, v = value) => {
      if (!v || !scene.current) return null;

      if (t === 'point') {
        const data = [{ lng: v[0], lat: v[1] }];
        const l = new PointLayer({ zIndex: 10 })
          .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(10)
          .color('#4e9bff');
        return l;
      }

      if (t === 'lineString') {
        const gj = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: v },
          properties: {},
        } as any;
        const l = new LineLayer({ zIndex: 9 }).source(gj).size(4).color('#4e9bff');
        return l;
      }

      if (t === 'polygon') {
        const coords = (v as [number, number][]).slice();
        if (coords.length) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
        }
        const gj = {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {},
        } as any;
        const l = new PolygonLayer({ zIndex: 8 })
          .source(gj)
          .shape('fill')
          .color('#4e9bff')
          .style({ opacity: 0.2, stroke: '#4e9bff', lineWidth: 2 });
        return l;
      }

      if (t === 'circle') {
        const ring = circleToPolygon([v[0], v[1]], v[2] ?? 0);
        const gj = {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {},
        } as any;
        const l = new PolygonLayer({ zIndex: 8 })
          .source(gj)
          .shape('fill')
          .color('#4e9bff')
          .style({ opacity: 0.2, stroke: '#4e9bff', lineWidth: 2 });
        return l;
      }

      return null;
    },
    [type, value],
  );

  const setOverlay = useCallback(
    (t = type, v = value) => {
      if (!scene.current) return;
      const nextLayer = getOverlay(t, v);
      if (nextLayer) {
        scene.current.addLayer(nextLayer);
      }
      return nextLayer;
    },
    [type, value, getOverlay],
  );

  // 初始化 L7 Scene
  useEffect(() => {
    if (!accessToken || scene.current) return;

    try {
      const newScene = new Scene({
        id: id.current,
        map: new Mapbox({
          token: accessToken,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [120.19382669582967, 30.258134],
          pitch: 0,
          zoom,
        }),
      });

      newScene.on('loaded', () => {
        scene.current = newScene;
        setErrMessage('');
        forceUpdate([]);
      });
    } catch (err) {
      setErrMessage(err instanceof Error ? err.message : String(err));
    }

    return () => {
      scene.current?.destroy();
      scene.current = null;
      layer.current = null;
      drawRef.current = null;
    };
  }, [accessToken, zoom]);

  // 只读模式或编辑模式
  useEffect(() => {
    if (!scene.current) return;

    // 只读模式：仅显示图形
    if (readonly) {
      if (value) {
        const nextLayer = setOverlay();
        layer.current = nextLayer;

        // 自动调整视图
        if (type === 'point') {
          scene.current.setCenter(value);
        } else if (type === 'circle') {
          scene.current.setCenter(value.slice(0, 2));
        } else if (type === 'lineString' || type === 'polygon') {
          const coords = value as [number, number][];
          if (coords?.length) {
            const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
            coords.forEach(([lng, lat]) => {
              bounds[0] = Math.min(bounds[0], lng);
              bounds[1] = Math.min(bounds[1], lat);
              bounds[2] = Math.max(bounds[2], lng);
              bounds[3] = Math.max(bounds[3], lat);
            });
            scene.current.fitBounds([
              [bounds[0], bounds[1]],
              [bounds[2], bounds[3]],
            ]);
          }
        }
      }
      return;
    }

    // 编辑模式被禁用
    if (disabled) return;

    // 编辑模式：可以绘制新图形或编辑已有图形
    (async () => {
      try {
        const mod: any = await import('@antv/l7-draw');
        let DrawCls: any = null;
        if (type === 'point') DrawCls = mod.DrawPoint;
        else if (type === 'lineString') DrawCls = mod.DrawLine;
        else if (type === 'polygon') DrawCls = mod.DrawPolygon;
        else if (type === 'circle') DrawCls = mod.DrawCircle;
        if (!DrawCls) return;

        const draw = new DrawCls(scene.current, {});
        drawRef.current = draw;

        if (!value) {
          // 没有值：绘制新图形
          draw.enable?.();

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
              draw.disable?.();
            }
          };
          draw.on('add', addHandler);
        } else {
          // 有值：编辑已有图形
          const nextLayer = setOverlay();
          layer.current = nextLayer;

          // Point 类型：点击地图重新选点
          if (type === 'point') {
            draw.enable?.();

            const addHandler = (feature: any) => {
              if (!feature?.geometry) return;
              const coords = feature.geometry.coordinates || [];
              if (coords.length >= 2) {
                const next = [coords[0], coords[1]];
                // 删除旧点，保存新点
                if (layer.current) {
                  scene.current?.removeLayer(layer.current);
                  layer.current = null;
                }
                onMapChange(next);
                draw.disable?.();
              }
            };
            draw.on('add', addHandler);
            return;
          }

          // 转换为 GeoJSON feature 供编辑
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
            draw.setData?.({ type: 'FeatureCollection', features: [geoJsonFeature] });
            draw.enable?.();

            // 监听编辑事件
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
        drawRef.current?.disable?.();
        drawRef.current?.destroy?.();
      } catch {
        // ignore cleanup errors
      }
      drawRef.current = null;
    };
  }, [value, type, disabled, readonly, onMapChange, setOverlay]);

  useImperativeHandle(ref, () => ({
    setOverlay,
    getOverlay,
    scene: scene.current,
    layer: layer.current,
    errMessage,
  }));

  const app = useApp();

  if (!accessToken || errMessage) {
    return (
      <Alert
        action={
          <Button
            type="primary"
            onClick={() => navigate(app.pluginSettingsManager.getRoutePath('map') + '?tab=mapbox')}
          >
            {t('Go to the configuration page')}
          </Button>
        }
        message={errMessage || t('Please configure the Access key first')}
        type="error"
      />
    );
  }

  return (
    <div
      className={css`
        position: relative;
        height: ${height || 500}px !important;
      `}
      id={id.current}
      style={props?.style}
    >
      {!scene.current && (
        <div
          className={css`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          `}
        >
          <Spin />
        </div>
      )}
      {!disabled ? (
        <>
          <div
            className={css`
              position: absolute;
              bottom: 80px;
              right: 20px;
              z-index: 10;
            `}
          >
            <Button
              onClick={onFocusOverlay}
              disabled={!layer.current}
              type="primary"
              shape="round"
              size="large"
              icon={<SyncOutlined />}
            ></Button>
          </div>
          <div
            className={css`
              position: absolute;
              bottom: 20px;
              right: 20px;
              z-index: 2;
            `}
          >
            <Button
              disabled={!value}
              style={{
                height: '40px',
              }}
              onClick={onReset}
              type="primary"
              danger
            >
              {t('Clear')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
});

MapboxComponent.displayName = 'MapboxComponent';
