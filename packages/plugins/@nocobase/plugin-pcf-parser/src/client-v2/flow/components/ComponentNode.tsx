import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface Point {
  x: number;
  y: number;
  z: number;
  bore?: number;
}

interface PcfComponentData {
  id: number;
  componentType: string;
  startPoint: Point | null;
  endPoint: Point | null;
  centrePoint: Point | null;
  skey: string | null;
}

interface ComponentNodeProps {
  component: PcfComponentData;
}

function toVec3(p: Point): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

function computeOrientation(start: THREE.Vector3, end: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  return { dir, length, mid };
}

// PCF coordinates are in millimetres but a 34 m pipe with the original
// 25-unit default radius renders at an aspect ratio of ~700:1, which is
// effectively invisible. When the PCF doesn't provide a bore, fall back
// to a length-proportional visual radius so the pipe is still readable
// at scale, with a sane floor.
function defaultVisualRadius(length: number): number {
  if (!isFinite(length) || length <= 0) return 50;
  return Math.max(50, length * 0.01);
}

function PipeMesh({ start, end, bore }: { start: THREE.Vector3; end: THREE.Vector3; bore?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { dir, length, mid } = computeOrientation(start, end);
  const radius = (bore && bore > 0 ? bore : defaultVisualRadius(length)) / 2;

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);

  return (
    <mesh ref={meshRef} position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <meshStandardMaterial color="#8899aa" metalness={0.6} roughness={0.4} />
    </mesh>
  );
}

function ElbowMesh({ start, end, centre }: { start: THREE.Vector3; end: THREE.Vector3; centre: THREE.Vector3 }) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(start, centre, end);
  }, [start, centre, end]);

  return (
    <mesh ref={tubeRef}>
      <tubeGeometry args={[curve, 20, 25, 12, false]} />
      <meshStandardMaterial color="#7788aa" metalness={0.6} roughness={0.4} />
    </mesh>
  );
}

function BoxMesh({ position, size, color }: { position: THREE.Vector3; size: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
    </mesh>
  );
}

function FlangeMesh({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { dir, length, mid } = computeOrientation(start, end);
  const radius = Math.max(length * 0.8, 40);
  const height = Math.max(length * 0.3, 15);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);

  return (
    <mesh ref={meshRef} position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, height, 24]} />
      <meshStandardMaterial color="#667799" metalness={0.7} roughness={0.3} />
    </mesh>
  );
}

function ReducerMesh({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { dir, length, mid } = computeOrientation(start, end);
  const r1 = 40;
  const r2 = 25;

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);

  return (
    <mesh ref={meshRef} position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[r1, r2, length, 16]} />
      <meshStandardMaterial color="#99887a" metalness={0.5} roughness={0.5} />
    </mesh>
  );
}

function TeeMesh({ centre, start, end }: { centre: THREE.Vector3; start: THREE.Vector3; end: THREE.Vector3 }) {
  const { dir, length } = computeOrientation(start, end);
  const radius = 30;
  const branchLen = Math.max(length * 0.5, 40);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);

  const branchQuat = useMemo(() => {
    const branchDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const perpDir = new THREE.Vector3().crossVectors(dir.clone().normalize(), new THREE.Vector3(0, 0, 1));
    if (perpDir.length() < 0.01) {
      perpDir.crossVectors(dir.clone().normalize(), new THREE.Vector3(1, 0, 0));
    }
    perpDir.normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), perpDir);
    return q;
  }, [dir, quaternion]);

  const branchOffset = branchLen / 2 + radius * 0.3;

  return (
    <group position={centre}>
      <mesh quaternion={quaternion}>
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshStandardMaterial color="#8899aa" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, branchOffset, 0]} quaternion={branchQuat}>
        <cylinderGeometry args={[radius * 0.8, radius * 0.8, branchLen, 16]} />
        <meshStandardMaterial color="#8899aa" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function SphereFallback({ position }: { position: THREE.Vector3 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[20, 16, 16]} />
      <meshStandardMaterial color="#aabbcc" metalness={0.4} roughness={0.6} />
    </mesh>
  );
}

export const ComponentNode: React.FC<ComponentNodeProps> = ({ component }) => {
  const { componentType, startPoint, endPoint, centrePoint } = component;

  if (!startPoint && !endPoint && !centrePoint) {
    return null;
  }

  const type = componentType.toUpperCase();
  const centre = centrePoint
    ? toVec3(centrePoint)
    : startPoint && endPoint
      ? new THREE.Vector3().addVectors(toVec3(startPoint), toVec3(endPoint)).multiplyScalar(0.5)
      : startPoint
        ? toVec3(startPoint)
        : toVec3(endPoint!);

  switch (type) {
    case 'PIPE': {
      if (!startPoint || !endPoint) return <SphereFallback position={centre} />;
      return <PipeMesh start={toVec3(startPoint)} end={toVec3(endPoint)} bore={startPoint.bore} />;
    }
    case 'ELBOW':
    case 'BEND': {
      if (!startPoint || !endPoint) return <SphereFallback position={centre} />;
      const bezCentre = centrePoint ? toVec3(centrePoint) : centre;
      return <ElbowMesh start={toVec3(startPoint)} end={toVec3(endPoint)} centre={bezCentre} />;
    }
    case 'VALVE': {
      return <BoxMesh position={centre} size={[50, 30, 50]} color="#cc6644" />;
    }
    case 'FLANGE': {
      if (!startPoint || !endPoint) return <BoxMesh position={centre} size={[60, 15, 60]} color="#667799" />;
      return <FlangeMesh start={toVec3(startPoint)} end={toVec3(endPoint)} />;
    }
    case 'GASKET': {
      return <BoxMesh position={centre} size={[50, 5, 50]} color="#88aa66" />;
    }
    case 'REDUCER':
    case 'SWAGE': {
      if (!startPoint || !endPoint) return <SphereFallback position={centre} />;
      return <ReducerMesh start={toVec3(startPoint)} end={toVec3(endPoint)} />;
    }
    case 'TEE':
    case 'BRANCH': {
      if (!startPoint || !endPoint) return <SphereFallback position={centre} />;
      return <TeeMesh centre={centre} start={toVec3(startPoint)} end={toVec3(endPoint)} />;
    }
    default: {
      return <SphereFallback position={centre} />;
    }
  }
};
