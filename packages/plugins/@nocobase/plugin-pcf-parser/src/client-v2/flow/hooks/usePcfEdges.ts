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

function pointKey(p: Point): string {
  return `${p.x}|${p.y}|${p.z}`;
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
    const seenPairKeys = new Set<string>();
    const withEndpoints = components.filter(
      (c) => c.startPoint || c.endPoint,
    );

    for (let i = 0; i < withEndpoints.length; i++) {
      for (let j = i + 1; j < withEndpoints.length; j++) {
        const a = withEndpoints[i];
        const b = withEndpoints[j];

        // Use a canonical pair key (smaller id first) to dedupe multiple
        // endpoint matches between the same two components — typical PCF
        // connections are sequential (A.endPoint == B.startPoint), so we
        // keep just one edge per component pair and discard any extra
        // endpoint combinations.
        const pairKey = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (seenPairKeys.has(pairKey)) continue;

        const aPts = getEndpoints(a);
        const bPts = getEndpoints(b);
        let matched = false;

        for (const ap of aPts) {
          if (matched) break;
          for (const bp of bPts) {
            if (distance(ap, bp) <= TOLERANCE) {
              seenPairKeys.add(pairKey);
              edges.push({
                id: `${a.id}-${b.id}-${pointKey(ap)}-${pointKey(bp)}`,
                fromId: a.id,
                toId: b.id,
                startPoint: ap,
                endPoint: bp,
              });
              matched = true;
              break;
            }
          }
        }
      }
    }

    return edges;
  }, [components]);
}
