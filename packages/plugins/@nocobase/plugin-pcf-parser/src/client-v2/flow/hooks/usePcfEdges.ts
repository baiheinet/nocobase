import { useMemo } from 'react';

interface Point {
  x: number;
  y: number;
  z: number;
}

interface PcfComponent {
  id: number;
  componentType: string;
  startPoint: Point | null;
  endPoint: Point | null;
  centrePoint: Point | null;
}

export interface PcfEdge {
  id: string;
  fromId: number;
  toId: number;
  startPoint: Point;
  endPoint: Point;
}

const TOLERANCE = 0.5;

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function getEndpoints(comp: PcfComponent): Point[] {
  const pts: Point[] = [];
  if (comp.startPoint) pts.push(comp.startPoint);
  if (comp.endPoint) pts.push(comp.endPoint);
  return pts;
}

export function usePcfEdges(components: PcfComponent[]): PcfEdge[] {
  return useMemo(() => {
    const edges: PcfEdge[] = [];
    const withEndpoints = components.filter(
      (c) => c.startPoint || c.endPoint,
    );

    for (let i = 0; i < withEndpoints.length; i++) {
      for (let j = i + 1; j < withEndpoints.length; j++) {
        const a = withEndpoints[i];
        const b = withEndpoints[j];
        const aPts = getEndpoints(a);
        const bPts = getEndpoints(b);

        for (const ap of aPts) {
          for (const bp of bPts) {
            if (distance(ap, bp) <= TOLERANCE) {
              edges.push({
                id: `${a.id}-${b.id}`,
                fromId: a.id,
                toId: b.id,
                startPoint: ap,
                endPoint: bp,
              });
            }
          }
        }
      }
    }

    return edges;
  }, [components]);
}
