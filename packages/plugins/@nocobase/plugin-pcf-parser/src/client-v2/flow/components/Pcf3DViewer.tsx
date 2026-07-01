import React, { useMemo, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Alert, Card, Select, Spin, Typography, Space, Tag } from 'antd';
import { ComponentNode } from './ComponentNode';
import { TopologyEdge } from './TopologyEdge';
import { usePcfData } from '../hooks/usePcfData';
import { usePcfEdges } from '../hooks/usePcfEdges';
import type { Pcf3DBlockModel } from '../models/Pcf3DBlockModel';

const { Text } = Typography;

interface Pcf3DViewerProps {
  sessionId: string;
  unitDisplay: 'original' | 'meter';
  model: Pcf3DBlockModel;
}

interface SceneBounds {
  center: [number, number, number];
  offset: number;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function SceneContent({
  components,
  edges,
  bounds,
}: {
  components: { id: number; componentType: string; startPoint: { x: number; y: number; z: number; bore?: number } | null; endPoint: { x: number; y: number; z: number; bore?: number } | null; centrePoint: { x: number; y: number; z: number } | null; skey: string | null }[];
  edges: { id: string; fromId: number; toId: number; startPoint: { x: number; y: number; z: number }; endPoint: { x: number; y: number; z: number } }[];
  bounds: SceneBounds;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls makeDefault target={bounds.center} />
      {components.map((c) => (
        <ComponentNode key={c.id} component={c} />
      ))}
      {edges.map((e) => (
        <TopologyEdge key={e.id} edge={e} />
      ))}
    </>
  );
}

export const Pcf3DViewer: React.FC<Pcf3DViewerProps> = ({ sessionId, unitDisplay, model }) => {
  const { session, components, loading, error } = usePcfData(sessionId);
  const edges = usePcfEdges(components);
  const [localUnitDisplay, setLocalUnitDisplay] = useState(unitDisplay);

  const effectiveUnitDisplay = localUnitDisplay || unitDisplay;

  const bounds = useMemo<SceneBounds>(() => {
    if (components.length === 0) {
      return { center: [0, 0, 0], offset: 200 };
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const c of components) {
      for (const p of [c.startPoint, c.endPoint, c.centrePoint]) {
        if (!p) continue;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        minZ = Math.min(minZ, p.z);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        maxZ = Math.max(maxZ, p.z);
      }
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const offset = Math.max(span * 1.5, 200);
    return { center: [cx, cy, cz], offset };
  }, [components]);

  const cameraPosition = useMemo<[number, number, number]>(() => {
    const [cx, cy, cz] = bounds.center;
    return [cx, cy + bounds.offset * 0.3, cz + bounds.offset];
  }, [bounds]);

  if (!hasWebGL()) {
    return (
      <Card title="PCF 3D Viewer">
        <Alert message="WebGL is not supported in your browser" type="warning" showIcon />
      </Card>
    );
  }

  if (!sessionId) {
    return (
      <Card title="PCF 3D Viewer">
        <Alert message="No session selected. Please configure the block settings to select a parse session." type="info" showIcon />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card title="PCF 3D Viewer">
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="PCF 3D Viewer">
        <Alert message={`Error loading data: ${error}`} type="error" showIcon />
      </Card>
    );
  }

  return (
    <Card
      title="PCF 3D Viewer"
      extra={
        <Space>
          {session && (
            <>
              <Tag color="blue">{session.fileName || 'unnamed'}</Tag>
              <Text type="secondary">{session.unitsCoOrds || 'MM'}</Text>
            </>
          )}
          <Select
            value={effectiveUnitDisplay}
            onChange={(val) => {
              setLocalUnitDisplay(val);
              model.setProps({ unitDisplay: val });
            }}
            options={[
              { label: 'Original', value: 'original' },
              { label: 'Meter', value: 'meter' },
            ]}
            size="small"
            style={{ width: 100 }}
          />
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ position: 'relative', height: 600 }}>
        <Suspense fallback={<div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>}>
          <Canvas camera={{ position: cameraPosition, fov: 50 }}>
            <SceneContent components={components} edges={edges} bounds={bounds} />
          </Canvas>
        </Suspense>
        <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 12, color: '#999' }}>
          {components.length} components, {edges.length} connections
        </div>
      </div>
    </Card>
  );
};
