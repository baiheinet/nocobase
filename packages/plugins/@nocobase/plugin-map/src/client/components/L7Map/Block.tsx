/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button, Space } from 'antd';
import { CheckOutlined, EnvironmentOutlined, ExpandOutlined } from '@ant-design/icons';
import {
  RecordProvider,
  css,
  getLabelFormatValue,
  useCollection,
  useCollectionManager_deprecated,
  useCollectionParentRecordData,
  useCollection_deprecated,
  useCompile,
  useFilterAPI,
  usePopupUtils,
  useProps,
} from '@nocobase/client';
import { useMemoizedFn } from 'ahooks';
import { PointLayer, LineLayer, PolygonLayer } from '@antv/l7';
import { defaultImage, selectedImage } from '../../constants';
import { useMapTranslation } from '../../locale';
import { getSource } from '../../utils';
import { MapBlockDrawer } from '../MapBlockDrawer';
import { L7MapComponent, L7MapForwardedRefProps } from './index';

/**
 * Unified L7 Map Block Component
 * Works with all map types (Mapbox, AMap, Google Maps)
 */
export const L7MapBlock = (props) => {
  const { collectionField, fieldNames, dataSource, fixedBlock, zoom, setSelectedRecordKeys, lineSort, mapType } =
    useProps(props);
  const { name, getPrimaryKey } = useCollection_deprecated();
  const primaryKey = getPrimaryKey();
  const [isMapInitialization, setIsMapInitialization] = useState(false);
  const mapRef = useRef<L7MapForwardedRefProps>();
  const dataLayersRef = useRef<any[]>([]);
  const [record, setRecord] = useState();
  const [selectingMode, setSelecting] = useState('');
  const [, setPrevSelected] = useState<any>(null);
  const selectingModeRef = useRef(selectingMode);
  selectingModeRef.current = selectingMode;
  const { t } = useMapTranslation();
  const compile = useCompile();
  const { isConnected, doFilter } = useFilterAPI();
  const { fields } = useCollection();
  const parentRecordData = useCollectionParentRecordData();
  const labelUiSchema = fields.find((v) => v.name === fieldNames?.marker)?.uiSchema;
  const { getCollectionJoinField } = useCollectionManager_deprecated();
  const { openPopup } = usePopupUtils();

  const mapRefCallback = (instance: L7MapForwardedRefProps) => {
    mapRef.current = instance;
    setIsMapInitialization(!!instance?.scene && !instance.errMessage);
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

  // 渲染数据源
  useEffect(() => {
    if (!collectionField || !dataSource?.length || !mapRef.current?.scene) return;

    const scene = mapRef.current.scene;
    const fieldPaths =
      Array.isArray(fieldNames?.field) && fieldNames?.field.length > 1
        ? fieldNames?.field.slice(0, -1)
        : fieldNames?.field;
    const cf = getCollectionJoinField([name, ...fieldPaths].flat().join('.'));

    const layers: any[] = [];
    const features: any[] = [];

    dataSource.forEach((item) => {
      const data = getSource(item, fieldNames?.field, cf?.interface)?.filter(Boolean);
      const title = getLabelFormatValue(labelUiSchema, item[fieldNames.marker]);
      if (!data?.length) return;

      data.forEach((mapItem) => {
        const id = item[primaryKey];
        if (collectionField.type === 'point') {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: mapItem },
            properties: { id, title: fieldNames?.marker ? compile(title) : '', selected: false },
          });
        } else if (collectionField.type === 'lineString') {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: mapItem },
            properties: { id, title: compile(title), selected: false },
          });
        } else if (collectionField.type === 'polygon') {
          const coords = mapItem.slice();
          if (coords.length) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
          }
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { id, title: compile(title), selected: false },
          });
        } else if (collectionField.type === 'circle') {
          const ring = circleToPolygon([mapItem[0], mapItem[1]], mapItem[2]);
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: { id, title: compile(title), selected: false },
          });
        }
      });
    });

    // 点图层
    if (collectionField.type === 'point' && features.length) {
      const pointLayer = new PointLayer({ zIndex: 5 })
        .source({ type: 'FeatureCollection', features }, { parser: { type: 'geojson' } })
        .shape('circle')
        .size(10)
        .color('selected', (selected) => (selected ? '#F18b62' : '#4e9bff'))
        .style({ cursor: 'pointer' });

      // 文本标签
      if (fieldNames?.marker) {
        const textLayer = new PointLayer({ zIndex: 6 })
          .source({ type: 'FeatureCollection', features }, { parser: { type: 'geojson' } })
          .shape('title', 'text')
          .size(12)
          .color('#000')
          .style({
            textAnchor: 'top',
            textOffset: [0, 15],
            stroke: '#fff',
            strokeWidth: 2,
          });
        layers.push(textLayer);
      }

      layers.push(pointLayer);

      // 线路连接
      if (lineSort?.length && features.length > 1) {
        const positions = features.map((f) => f.geometry.coordinates);
        const lineFeature = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: positions },
          properties: {},
        };
        const lineLayer = new LineLayer({ zIndex: 4 })
          .source(lineFeature)
          .size(2)
          .color('#4e9bff')
          .style({ opacity: 0.6 });
        layers.push(lineLayer);
      }
    }

    // 线图层
    if (collectionField.type === 'lineString' && features.length) {
      const lineLayer = new LineLayer({ zIndex: 5 })
        .source({ type: 'FeatureCollection', features }, { parser: { type: 'geojson' } })
        .size(4)
        .color('selected', (selected) => (selected ? '#F18b62' : '#4e9bff'))
        .style({ cursor: 'pointer' });
      layers.push(lineLayer);
    }

    // 面图层
    if ((collectionField.type === 'polygon' || collectionField.type === 'circle') && features.length) {
      const polygonLayer = new PolygonLayer({ zIndex: 5 })
        .source({ type: 'FeatureCollection', features }, { parser: { type: 'geojson' } })
        .shape('fill')
        .color('selected', (selected) => (selected ? '#F18b62' : '#4e9bff'))
        .style({
          opacity: 0.2,
          cursor: 'pointer',
        });
      layers.push(polygonLayer);
    }

    // 添加图层到场景
    layers.forEach((layer) => {
      scene.addLayer(layer);

      // 点击事件
      layer.on('click', (e) => {
        if (!e.feature?.properties?.id) return;
        const { id, selected } = e.feature.properties;

        if (selectingModeRef.current === 'click') {
          // 多选模式
          setSelectedRecordKeys((keys) => (selected ? keys.filter((key) => key !== id) : [...keys, id]));
          // 更新选中状态
          const updatedFeatures = features.map((f) =>
            f.properties.id === id ? { ...f, properties: { ...f.properties, selected: !selected } } : f,
          );
          layer.setData({ type: 'FeatureCollection', features: updatedFeatures });
          return;
        }

        if (selectingModeRef.current) return;

        const data = dataSource.find((item) => item[primaryKey] === id);

        // 筛选区块模式
        if (isConnected) {
          setPrevSelected((prev) => {
            if (prev === id) {
              doFilter(null);
              return null;
            } else {
              doFilter(data[primaryKey], (target) => target.field || primaryKey, '$eq');
            }
            return id;
          });
          return;
        }

        if (data) {
          setRecord(data);
          openPopup({ recordData: data });
        }
      });
    });

    dataLayersRef.current = layers;

    // 自动适应视图
    const bounds = features.reduce(
      (acc, f) => {
        const coords =
          f.geometry.type === 'Point'
            ? [f.geometry.coordinates]
            : f.geometry.type === 'LineString'
              ? f.geometry.coordinates
              : f.geometry.coordinates[0];

        coords.forEach(([lng, lat]) => {
          acc[0] = Math.min(acc[0], lng);
          acc[1] = Math.min(acc[1], lat);
          acc[2] = Math.max(acc[2], lng);
          acc[3] = Math.max(acc[3], lat);
        });
        return acc;
      },
      [Infinity, Infinity, -Infinity, -Infinity],
    );

    if (bounds[0] !== Infinity) {
      // Use scene's fitBounds method
      mapRef.current?.scene?.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 50 },
      );
    }

    return () => {
      dataLayersRef.current.forEach((layer) => {
        scene?.removeLayer(layer);
      });
      dataLayersRef.current = [];
    };
  }, [dataSource, isMapInitialization, fieldNames, name, primaryKey, collectionField.type, isConnected, lineSort]);

  // 选择模式 - 框选
  useEffect(() => {
    if (selectingMode !== 'selection') {
      return;
    }

    (async () => {
      try {
        const mod: any = await import('@antv/l7-draw');
        const DrawPolygon = mod.DrawPolygon;
        const draw = new DrawPolygon(mapRef.current?.scene, {});
        draw.enable();

        draw.on('add', (feature) => {
          const polygon = feature.geometry.coordinates[0];
          const selectedIds: any[] = [];

          dataSource.forEach((item) => {
            const data = getSource(item, fieldNames?.field, collectionField.interface)?.filter(Boolean);
            if (!data?.length) return;

            data.forEach((mapItem) => {
              let isInside = false;
              if (collectionField.type === 'point') {
                isInside = pointInPolygon(mapItem, polygon);
              } else if (collectionField.type === 'lineString' || collectionField.type === 'polygon') {
                isInside = mapItem.some((pt) => pointInPolygon(pt, polygon));
              } else if (collectionField.type === 'circle') {
                isInside = pointInPolygon([mapItem[0], mapItem[1]], polygon);
              }

              if (isInside) {
                selectedIds.push(item[primaryKey]);
              }
            });
          });

          setSelectedRecordKeys((lastIds) => [...new Set([...selectedIds, ...lastIds])]);
          draw.disable();
          draw.destroy();
        });
      } catch (e) {
        console.error('Failed to load l7-draw:', e);
      }
    })();
  }, [selectingMode]);

  useEffect(() => {
    if (selectingMode) {
      return () => {
        if (!selectingModeRef.current && dataLayersRef.current.length) {
          // 清除选中状态
          setSelectedRecordKeys([]);
        }
      };
    }
  }, [selectingMode]);

  useEffect(() => {
    setTimeout(() => {
      setSelectedRecordKeys([]);
    });
  }, [dataSource]);

  return (
    <div
      className={css`
        position: relative;
        height: 100%;
      `}
    >
      <div
        className={css`
          position: absolute;
          left: 10px;
          top: 10px;
          z-index: 999;
        `}
      >
        {isMapInitialization && !mapRef.current?.errMessage ? (
          <Space direction="vertical">
            <Button
              style={{
                color: !selectingMode ? '#F18b62' : undefined,
                borderColor: 'currentcolor',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelecting('');
              }}
              icon={<EnvironmentOutlined />}
            />
            <Button
              style={{
                color: selectingMode === 'click' ? '#F18b62' : undefined,
                borderColor: 'currentcolor',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelecting('click');
              }}
              icon={<CheckOutlined />}
            />
            <Button
              style={{
                color: selectingMode === 'selection' ? '#F18b62' : undefined,
                borderColor: 'currentcolor',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelecting('selection');
              }}
              icon={<ExpandOutlined />}
            />
          </Space>
        ) : null}
      </div>
      <RecordProvider record={record} parent={parentRecordData}>
        <MapBlockDrawer />
      </RecordProvider>
      <L7MapComponent
        {...collectionField?.uiSchema?.['x-component-props']}
        mapType={mapType}
        ref={mapRefCallback}
        style={{ height: fixedBlock ? '100%' : null }}
        zoom={zoom}
        disabled
        block
      />
    </div>
  );
};

// 辅助函数：判断点是否在多边形内
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
