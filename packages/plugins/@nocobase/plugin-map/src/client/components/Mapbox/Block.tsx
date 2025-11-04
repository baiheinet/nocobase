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
import { MapboxComponent, MapboxForwardedRefProps } from './Map';

export const MapboxBlock = (props) => {
  const { collectionField, fieldNames, dataSource, fixedBlock, zoom, setSelectedRecordKeys, lineSort } =
    useProps(props);
  const { name, getPrimaryKey } = useCollection_deprecated();
  const primaryKey = getPrimaryKey();
  const [isMapInitialization, setIsMapInitialization] = useState(false);
  const mapRef = useRef<MapboxForwardedRefProps>();
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

  const mapRefCallback = (instance: MapboxForwardedRefProps) => {
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
            properties: { id, title: fieldNames?.marker ? compile(title) : '', selected: false },
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
            properties: { id, title: fieldNames?.marker ? compile(title) : '', selected: false },
          });
        } else if (collectionField.type === 'circle') {
          const ring = circleToPolygon([mapItem[0], mapItem[1]], mapItem[2] ?? 0);
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: { id, title: fieldNames?.marker ? compile(title) : '', selected: false },
          });
        }
      });
    });

    if (features.length) {
      // 计算所有坐标的边界
      const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      features.forEach((feature) => {
        const coords = feature.geometry.coordinates;
        if (feature.geometry.type === 'Point') {
          const [lng, lat] = coords as [number, number];
          bounds[0] = Math.min(bounds[0], lng);
          bounds[1] = Math.min(bounds[1], lat);
          bounds[2] = Math.max(bounds[2], lng);
          bounds[3] = Math.max(bounds[3], lat);
        } else if (feature.geometry.type === 'LineString') {
          (coords as [number, number][]).forEach(([lng, lat]) => {
            bounds[0] = Math.min(bounds[0], lng);
            bounds[1] = Math.min(bounds[1], lat);
            bounds[2] = Math.max(bounds[2], lng);
            bounds[3] = Math.max(bounds[3], lat);
          });
        } else if (feature.geometry.type === 'Polygon') {
          (coords as [[number, number][]])[0].forEach(([lng, lat]) => {
            bounds[0] = Math.min(bounds[0], lng);
            bounds[1] = Math.min(bounds[1], lat);
            bounds[2] = Math.max(bounds[2], lng);
            bounds[3] = Math.max(bounds[3], lat);
          });
        }
      });

      // 自动调整地图视图
      if (bounds[0] !== Infinity) {
        scene.fitBounds([
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ]);
      }

      if (collectionField.type === 'point') {
        const layer = new PointLayer({ zIndex: 10 })
          .source({ type: 'FeatureCollection', features })
          .shape('circle')
          .size(10)
          .color('selected', (selected) => (selected ? '#F18b62' : '#4e9bff'));

        scene.addLayer(layer);
        layers.push(layer);

        layer.on('click', (e) => {
          if (!e.feature?.properties?.id) return;
          const { id } = e.feature.properties;
          if (selectingModeRef.current === 'click') {
            const selected = e.feature.properties.selected;
            e.feature.properties.selected = !selected;
            layer.setData({ type: 'FeatureCollection', features });
            setSelectedRecordKeys((keys) => (selected ? keys.filter((key) => key !== id) : [...keys, id]));
            return;
          }

          if (isConnected) {
            setPrevSelected((prev) => {
              if (prev === id) {
                doFilter(null);
                return null;
              } else {
                doFilter(id, (target) => target.field || primaryKey, '$eq');
              }
              return id;
            });
            return;
          }

          const data = dataSource.find((item) => item[primaryKey] === id);
          if (data) {
            setRecord(data);
            openPopup({ recordData: data });
          }
        });
      } else if (collectionField.type === 'lineString') {
        const layer = new LineLayer({ zIndex: 9 })
          .source({ type: 'FeatureCollection', features })
          .size(4)
          .color('selected', (selected) => (selected ? '#F18b62' : '#4e9bff'));

        scene.addLayer(layer);
        layers.push(layer);

        layer.on('click', (e) => {
          const { id } = e.feature.properties;
          if (selectingModeRef.current === 'click') {
            const selected = e.feature.properties.selected;
            e.feature.properties.selected = !selected;
            layer.setData({ type: 'FeatureCollection', features });
            setSelectedRecordKeys((keys) => (selected ? keys.filter((key) => key !== id) : [...keys, id]));
            return;
          }

          if (isConnected) {
            setPrevSelected((prev) => {
              if (prev === id) {
                doFilter(null);
                return null;
              } else {
                doFilter(id, (target) => target.field || primaryKey, '$eq');
              }
              return id;
            });
            return;
          }

          const data = dataSource.find((item) => item[primaryKey] === id);
          if (data) {
            setRecord(data);
            openPopup({ recordData: data });
          }
        });
      } else if (collectionField.type === 'polygon' || collectionField.type === 'circle') {
        const layer = new PolygonLayer({ zIndex: 8 })
          .source({ type: 'FeatureCollection', features })
          .shape('fill')
          .color('selected', (selected) => (selected ? '#F18b62' : '#4e9bff'))
          .style({ opacity: 0.6 });

        scene.addLayer(layer);
        layers.push(layer);

        layer.on('click', (e) => {
          const { id } = e.feature.properties;
          if (selectingModeRef.current === 'click') {
            const selected = e.feature.properties.selected;
            e.feature.properties.selected = !selected;
            layer.setData({ type: 'FeatureCollection', features });
            setSelectedRecordKeys((keys) => (selected ? keys.filter((key) => key !== id) : [...keys, id]));
            return;
          }

          if (isConnected) {
            setPrevSelected((prev) => {
              if (prev === id) {
                doFilter(null);
                return null;
              } else {
                doFilter(id, (target) => target.field || primaryKey, '$eq');
              }
              return id;
            });
            return;
          }

          const data = dataSource.find((item) => item[primaryKey] === id);
          if (data) {
            setRecord(data);
            openPopup({ recordData: data });
          }
        });
      }
    }

    dataLayersRef.current = layers;

    return () => {
      layers.forEach((layer) => {
        scene.removeLayer(layer);
      });
      dataLayersRef.current = [];
    };
  }, [
    dataSource,
    isMapInitialization,
    fieldNames,
    name,
    primaryKey,
    collectionField.type,
    isConnected,
    lineSort,
    openPopup,
  ]);

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
            ></Button>
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
            ></Button>
            {selectingMode === 'selection' ? (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                title={t('Confirm selection')}
                onClick={() => {
                  // TODO: 实现多边形选择确认
                  setSelecting('');
                }}
              ></Button>
            ) : null}
          </Space>
        ) : null}
      </div>
      <RecordProvider record={record} parent={parentRecordData}>
        <MapBlockDrawer />
      </RecordProvider>
      <MapboxComponent
        {...collectionField?.uiSchema?.['x-component-props']}
        ref={mapRefCallback}
        style={{ height: fixedBlock ? '100%' : null }}
        zoom={zoom}
        disabled
        block
      ></MapboxComponent>
    </div>
  );
};
