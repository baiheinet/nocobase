import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { PcfEdge } from '../hooks/usePcfEdges';

interface TopologyEdgeProps {
  edge: PcfEdge;
}

export const TopologyEdge: React.FC<TopologyEdgeProps> = ({ edge }) => {
  const points = useMemo(() => {
    return [
      new THREE.Vector3(edge.startPoint.x, edge.startPoint.y, edge.startPoint.z),
      new THREE.Vector3(edge.endPoint.x, edge.endPoint.y, edge.endPoint.z),
    ];
  }, [edge]);

  return (
    <Line
      points={points}
      color="#44aaff"
      lineWidth={2}
      transparent
      opacity={0.6}
    />
  );
};
