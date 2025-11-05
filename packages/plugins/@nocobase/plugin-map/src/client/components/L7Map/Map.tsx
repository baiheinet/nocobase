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
import { Scene, PointLayer, LineLayer, PolygonLayer } from '@antv/l7';
import { useMapConfiguration } from '../../hooks';
import { useMapTranslation } from '../../locale';
import { MapEditorType } from '../../types';
import { useMapHeight } from '../hook';
import { MapAdapterFactory, IMapAdapter } from './adapters';
import { Draw } from './Draw';

export interface L7MapComponentProps {
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  mapType: 'mapbox' | 'google';
  readonly?: boolean;
  zoom?: number;
  type?: MapEditorType;
  style?: React.CSSProperties;
  block?: boolean;
}

export interface L7MapForwardedRefProps {
  setOverlay: (t: MapEditorType, v: any) => any;
  getOverlay: (t: MapEditorType, v: any) => any;
  scene: Scene;
  layer: any;
  adapter: IMapAdapter;
  errMessage?: string;
}

export const L7MapComponent = React.forwardRef<L7MapForwardedRefProps, L7MapComponentProps>((props, ref) => {
  const { value, onChange, block = false, readonly = false, disabled = block, zoom = 13, mapType } = props;
  const { accessKey, securityJsCode } = useMapConfiguration(mapType) || {};
  const { t } = useMapTranslation();
  const fieldSchema = useFieldSchema();
  const scene = useRef<Scene>();
  const overlayLayer = useRef<any>(null);
  const { getField } = useCollection_deprecated();
  const type = useMemo<MapEditorType>(() => {
    if (props.type) return props.type;
    const collectionField = getField(fieldSchema?.name);
    return collectionField?.interface;
  }, [props?.type, fieldSchema?.name]);
  // Helpers to render overlays locally (Draw handles only interactions)
  const circleToPolygon = useCallback((center: [number, number], radius: number, steps = 64) => {
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
  }, []);

  const getOverlay = useCallback(
    (t?: MapEditorType, v?: any) => {
      const tt = t ?? type;
      const vv = v ?? value;
      if (!vv) return null;
      if (tt === 'point') {
        const data = [{ lng: vv[0], lat: vv[1] }];
        return new PointLayer({ zIndex: 10 })
          .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(10)
          .color('#4e9bff');
      }
      if (tt === 'lineString') {
        const gj = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: vv },
          properties: {},
        } as any;
        return new LineLayer({ zIndex: 9 }).source(gj).size(4).color('#4e9bff');
      }
      if (tt === 'polygon') {
        const coords = (vv as [number, number][]).slice();
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
        return new PolygonLayer({ zIndex: 8 })
          .source(gj)
          .shape('fill')
          .color('#4e9bff')
          .style({ opacity: 0.2, stroke: '#4e9bff', lineWidth: 2 });
      }
      if (tt === 'circle') {
        const ring = circleToPolygon([vv[0], vv[1]], vv[2] ?? 0);
        const gj = {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {},
        } as any;
        return new PolygonLayer({ zIndex: 8 })
          .source(gj)
          .shape('fill')
          .color('#4e9bff')
          .style({ opacity: 0.2, stroke: '#4e9bff', lineWidth: 2 });
      }
      return null;
    },
    [type, value, circleToPolygon],
  );

  const removeOverlay = useCallback(() => {
    if (overlayLayer.current && scene.current) {
      try {
        scene.current.removeLayer(overlayLayer.current);
      } catch {
        // Ignore layer removal errors
      }
      overlayLayer.current = null;
    }
  }, []);

  const setOverlay = useCallback(
    (t?: MapEditorType, v?: any) => {
      if (!scene.current) return null;
      removeOverlay();
      const next = getOverlay(t, v);
      if (next) {
        scene.current.addLayer(next);
        overlayLayer.current = next;
      }
      return next;
    },
    [getOverlay, removeOverlay],
  );

  const adapter = useRef<IMapAdapter>();
  const [needUpdateFlag, forceUpdate] = useState([]);
  const [errMessage, setErrMessage] = useState('');
  const [isMapInitialization, setIsMapInitialization] = useState(false);
  const navigate = useNavigateNoUpdate();
  const { modal } = App.useApp();
  const height = useMapHeight();
  const app = useApp();

  const id = useRef(`nocobase-l7-map-${mapType}-${type || ''}-${Date.now().toString(32)}`);

  // Initialize L7 Scene with map adapter
  useEffect(() => {
    if (!accessKey || scene.current) return;

    // Only initialize Mapbox for now (AMap and Google Maps need additional work)
    if (mapType !== 'mapbox') {
      setErrMessage(`${mapType} is not fully supported yet. Please use Mapbox.`);
      return;
    }

    (async () => {
      try {
        // Create adapter
        const mapAdapter = MapAdapterFactory.create(mapType);
        adapter.current = mapAdapter;

        // Create base map
        const baseMap = await mapAdapter.createMap({
          container: id.current,
          center: [120.19382669582967, 30.258134],
          zoom,
          pitch: 0,
          accessKey,
          securityJsCode,
        });

        // Create L7 Scene
        const newScene = new Scene({
          id: id.current,
          map: baseMap,
        });

        // Wait for scene to be fully loaded before setting ref
        newScene.on('loaded', () => {
          scene.current = newScene;
          setErrMessage('');
          setIsMapInitialization(true);
          forceUpdate([]);
        });

        newScene.on('error', (err) => {
          setErrMessage(err?.message || 'Map initialization error');
        });
      } catch (err) {
        setErrMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      setIsMapInitialization(false);
      scene.current?.destroy();
      scene.current = null;
      adapter.current?.destroy();
      adapter.current = null;
    };
  }, [accessKey, securityJsCode, mapType, zoom]);

  // Update zoom when prop changes
  useEffect(() => {
    if (scene.current) {
      scene.current.setZoom(zoom);
    }
  }, [zoom]);

  // Keep Draw only for interaction (create/edit); overlay is handled in this component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  Draw(scene.current, type, value, onChange, disabled);

  // Update overlay whenever value changes
  // Overlay provides visual feedback; Draw tools handle interactions
  useEffect(() => {
    if (!scene.current || !isMapInitialization) return;
    removeOverlay();
    if (value) {
      setOverlay(type, value);
    }
    return () => {
      removeOverlay();
    };
  }, [isMapInitialization, type, value, removeOverlay, setOverlay]);

  // Auto-fit view in readonly mode
  useEffect(() => {
    if (!scene.current || !isMapInitialization || !readonly || !value) return;

    // Auto-fit view to overlay
    if (type === 'point' && Array.isArray(value) && value.length >= 2) {
      const center: [number, number] = [value[0], value[1]];
      scene.current.setCenter(center);
    } else if (type === 'circle' && Array.isArray(value) && value.length >= 2) {
      const center: [number, number] = [value[0], value[1]];
      scene.current.setCenter(center);
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
  }, [isMapInitialization, readonly, value, type]);

  const onReset = () => {
    modal.confirm({
      title: t('Clear the canvas'),
      content: t('Are you sure to clear the canvas?'),
      okText: t('Confirm'),
      cancelText: t('Cancel'),
      getContainer: () => document.getElementById(id.current),
      onOk() {
        removeOverlay();
        onChange?.(null);
      },
    });
  };

  const onFocusOverlay = () => {
    if (overlayLayer.current && value && scene.current) {
      try {
        if (Array.isArray(value)) {
          if (type === 'point') {
            const center: [number, number] = [value[0], value[1]];
            scene.current.setCenter(center);
          } else if (type === 'circle') {
            const center: [number, number] = [value[0], value[1]];
            scene.current.setCenter(center);
          } else {
            const coords = value as [number, number][];
            if (coords?.length) {
              const cx = coords.reduce((s, p) => s + p[0], 0) / coords.length;
              const cy = coords.reduce((s, p) => s + p[1], 0) / coords.length;
              scene.current.setCenter([cx, cy]);
            }
          }
        }
      } catch (e) {
        /* noop */
      }
    }
  };

  useImperativeHandle(ref, () => ({
    setOverlay,
    getOverlay,
    scene: scene.current,
    layer: overlayLayer.current,
    adapter: adapter.current,
    errMessage,
  }));

  if (!accessKey || errMessage) {
    return (
      <Alert
        action={
          <Button
            type="primary"
            onClick={() => navigate(app.pluginSettingsManager.getRoutePath('map') + `?tab=${mapType}`)}
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
      {!disabled && !readonly ? (
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
              disabled={!overlayLayer.current}
              type="primary"
              shape="round"
              size="large"
              icon={<SyncOutlined />}
            />
          </div>
          <div
            className={css`
              position: absolute;
              bottom: 20px;
              right: 20px;
              z-index: 2;
            `}
          >
            <Button disabled={!value} style={{ height: '40px' }} onClick={onReset} type="primary" danger>
              {t('Clear')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
});

L7MapComponent.displayName = 'L7MapComponent';
