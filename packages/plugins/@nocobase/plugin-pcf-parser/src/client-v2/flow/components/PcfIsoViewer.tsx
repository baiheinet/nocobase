import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Spin, Alert, Button, Space } from 'antd';
import { usePcfData } from '../hooks/usePcfData';
import { usePcfEdges, PcfEdge } from '../hooks/usePcfEdges';
import { tExpr } from '../../locale';

interface PcfComponent {
  id: number;
  sessionId: string;
  pipelineReference: string;
  componentType: string;
  componentIdentifier: string | null;
  startPoint: { x: number; y: number; z: number; bore?: number } | null;
  endPoint: { x: number; y: number; z: number; bore?: number } | null;
  centrePoint: { x: number; y: number; z: number } | null;
  materialIdentifier: string | null;
  weldNumber: string | null;
}

interface Point2D {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface PcfIsoViewerProps {
  sessionId: string;
  unitDisplay: string;
  model?: unknown;
  projection?: 'isometric';
  angle?: number;
  showLabels?: boolean;
  showWeldNumbers?: boolean;
  heightMode?: string;
  height?: number;
}

const LABELED_TYPES = [
  'PIPE',
  'ELBOW',
  'BEND',
  'TEE',
  'BRANCH',
  'VALVE',
  'OLET',
];

function project(
  p: { x: number; y: number; z: number },
  angleDeg: number = 30,
): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  return {
    x: (p.z - p.x) * cosA,
    y: (p.x + p.z) * sinA - p.y,
  };
}

function getAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance2D(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

interface NormalizedData {
  components: Array<
    PcfComponent & {
      start2D: Point2D | null;
      end2D: Point2D | null;
      centre2D: Point2D | null;
    }
  >;
  edges: Array<PcfEdge & { start2D: Point2D; end2D: Point2D }>;
  bounds: Bounds;
  maxExtent: number;
}

function normalizeData(
  components: PcfComponent[],
  edges: PcfEdge[],
  angleDeg: number = 30,
): NormalizedData {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const projected = components.map((comp) => {
    const start2D = comp.startPoint ? project(comp.startPoint, angleDeg) : null;
    const end2D = comp.endPoint ? project(comp.endPoint, angleDeg) : null;
    const centre2D = comp.centrePoint ? project(comp.centrePoint, angleDeg) : null;
    return { ...comp, start2D, end2D, centre2D };
  });

  const addPoint = (p: Point2D) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  };

  for (const comp of projected) {
    if (comp.start2D) addPoint(comp.start2D);
    if (comp.end2D) addPoint(comp.end2D);
    if (comp.centre2D) addPoint(comp.centre2D);
  }

  const projectedEdges = edges.map((edge) => ({
    ...edge,
    start2D: project(edge.startPoint, angleDeg),
    end2D: project(edge.endPoint, angleDeg),
  }));

  for (const edge of projectedEdges) {
    addPoint(edge.start2D);
    addPoint(edge.end2D);
  }

  if (!isFinite(minX)) {
    return {
      components: [],
      edges: [],
      bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 },
      maxExtent: 1000,
    };
  }

  const extentX = maxX - minX;
  const extentY = maxY - minY;
  // Pad each axis independently; keep a small absolute padding so tiny models
  // still have some breathing room.
  const paddingX = Math.max(extentX * 0.05, 50);
  const paddingY = Math.max(extentY * 0.05, 50);

  // ISO drawings of long pipelines can be extremely wide-and-thin. That is
  // mathematically correct, but in a default NocoBase card the content can
  // collapse to a few pixels tall. Cap the aspect ratio at 8:1 by adding
  // vertical padding. This only adds whitespace; it does not distort data.
  const targetHeight = Math.max(extentY + paddingY * 2, (extentX + paddingX * 2) / 8);
  const extraY = Math.max(0, targetHeight - (extentY + paddingY * 2)) / 2;

  const offsetX = minX - paddingX;
  const offsetY = minY - paddingY - extraY;

  const bounds: Bounds = {
    minX: 0,
    maxX: extentX + paddingX * 2,
    minY: 0,
    maxY: targetHeight,
    width: extentX + paddingX * 2,
    height: targetHeight,
  };

  const normalizePoint = (p: Point2D): Point2D => ({ x: p.x - offsetX, y: p.y - offsetY });

  return {
    components: projected.map((comp) => ({
      ...comp,
      start2D: comp.start2D ? normalizePoint(comp.start2D) : null,
      end2D: comp.end2D ? normalizePoint(comp.end2D) : null,
      centre2D: comp.centre2D ? normalizePoint(comp.centre2D) : null,
    })),
    edges: projectedEdges.map((edge) => ({
      ...edge,
      start2D: normalizePoint(edge.start2D),
      end2D: normalizePoint(edge.end2D),
    })),
    bounds,
    maxExtent: Math.max(bounds.width, bounds.height, 1000),
  };
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngleDeg);
  const end = polarToCartesian(cx, cy, r, startAngleDeg);
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function pickLabelPos(
  comp: PcfComponent & {
    start2D: Point2D | null;
    end2D: Point2D | null;
    centre2D: Point2D | null;
  },
): Point2D | null {
  if (comp.centre2D) return comp.centre2D;
  if (comp.start2D && comp.end2D) return midpoint(comp.start2D, comp.end2D);
  return comp.start2D || comp.end2D;
}

function ComponentLabel({
  comp,
  fontSize,
  offsetY,
}: {
  comp: PcfComponent & {
    start2D: Point2D | null;
    end2D: Point2D | null;
    centre2D: Point2D | null;
  };
  fontSize: number;
  offsetY: number;
}) {
  const pos = pickLabelPos(comp);
  if (!pos) return null;
  const text = comp.componentType || '';
  if (!text) return null;
  if (!LABELED_TYPES.includes((comp.componentType || '').toUpperCase())) return null;
  return (
    <text
      x={pos.x}
      y={pos.y - offsetY}
      fontSize={fontSize}
      fill="#333"
      stroke="#fff"
      strokeWidth={fontSize * 0.18}
      paintOrder="stroke fill"
      textAnchor="middle"
      dominantBaseline="alphabetic"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {text}
    </text>
  );
}

function WeldNumberLabel({
  comp,
  fontSize,
}: {
  comp: PcfComponent & {
    start2D: Point2D | null;
    end2D: Point2D | null;
    centre2D: Point2D | null;
  };
  fontSize: number;
}) {
  if ((comp.componentType || '').toUpperCase() !== 'WELD') return null;
  if (!comp.weldNumber) return null;

  const pos = comp.start2D || comp.centre2D || comp.end2D;
  if (!pos) return null;

  const offset = Math.max(fontSize * 0.55, 8);
  return (
    <text
      x={pos.x + offset}
      y={pos.y - offset}
      fontSize={fontSize}
      fill="#9E9E9E"
      stroke="#fff"
      strokeWidth={fontSize * 0.18}
      paintOrder="stroke fill"
      textAnchor="start"
      dominantBaseline="alphabetic"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {`<${comp.weldNumber}>`}
    </text>
  );
}

function ComponentSymbol({
  comp,
  symbolSize,
  strokeW,
  dim,
}: {
  comp: NormalizedData['components'][number];
  symbolSize: number;
  strokeW: number;
  dim: number;
}) {
  const type = (comp.componentType || '').toUpperCase();

  const hasStartEnd = comp.start2D && comp.end2D;
  const hasCentre = !!comp.centre2D;
  const pos: Point2D | null = hasStartEnd
    ? midpoint(comp.start2D!, comp.end2D!)
    : hasCentre
      ? comp.centre2D!
      : comp.start2D
        ? comp.start2D
        : comp.end2D
          ? comp.end2D
          : null;

  if (!pos) return null;

  const angle = hasStartEnd ? getAngle(comp.start2D!, comp.end2D!) : 0;

  const px = pos.x;
  const py = pos.y;
  const h = symbolSize * 0.5;
  const perpAngle = angle + Math.PI / 2;
  const dx = h * Math.cos(perpAngle);
  const dy = h * Math.sin(perpAngle);

  switch (type) {
    case 'PIPE': {
      if (comp.start2D && comp.end2D) {
        const s = comp.start2D;
        const e = comp.end2D;
        const col =
          comp.pipelineReference?.includes('BRANCH') || comp.pipelineReference?.includes('branch')
            ? '#2196F3'
            : '#1565C0';
        return (
          <line
            x1={s.x}
            y1={s.y}
            x2={e.x}
            y2={e.y}
            stroke={col}
            strokeWidth={strokeW * 2}
            strokeLinecap="round"
          />
        );
      }
      return null;
    }
    case 'ELBOW':
    case 'BEND': {
      if (!comp.start2D || !comp.end2D) {
        return (
          <circle
            cx={px}
            cy={py}
            r={h * 0.6}
            fill="none"
            stroke="#E65100"
            strokeWidth={strokeW}
          />
        );
      }
      const startA = getAngle(comp.start2D, pos);
      const endA = getAngle(pos, comp.end2D);
      const r = h * 0.8;
      const x1 = px + r * Math.cos(startA);
      const y1 = py + r * Math.sin(startA);
      const x2 = px + r * Math.cos(endA);
      const y2 = py + r * Math.sin(endA);
      const largeArc = Math.abs(endA - startA) > Math.PI ? 1 : 0;
      return (
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke="#E65100"
          strokeWidth={strokeW * 1.5}
          strokeLinecap="round"
        />
      );
    }
    case 'FLANGE': {
      return (
        <>
          <line
            x1={px - dx}
            y1={py - dy}
            x2={px + dx}
            y2={py + dy}
            stroke="#333"
            strokeWidth={strokeW * 3}
            strokeLinecap="butt"
          />
          <rect
            x={px - dx - dim * 0.3}
            y={py - dy - dim * 0.3}
            width={dim * 0.6}
            height={dim * 0.6}
            fill="#555"
          />
          <rect
            x={px + dx - dim * 0.3}
            y={py + dy - dim * 0.3}
            width={dim * 0.6}
            height={dim * 0.6}
            fill="#555"
          />
        </>
      );
    }
    case 'GASKET': {
      const gdx = h * 0.8 * Math.cos(perpAngle);
      const gdy = h * 0.8 * Math.sin(perpAngle);
      const gdx2 = h * 0.4 * Math.cos(perpAngle);
      const gdy2 = h * 0.4 * Math.sin(perpAngle);
      return (
        <>
          <line
            x1={px - gdx}
            y1={py - gdy}
            x2={px + gdx}
            y2={py + gdy}
            stroke="#666"
            strokeWidth={strokeW}
          />
          <line
            x1={px - gdx2}
            y1={py - gdy2}
            x2={px + gdx2}
            y2={py + gdy2}
            stroke="#666"
            strokeWidth={strokeW}
          />
        </>
      );
    }
    case 'TEE':
    case 'BRANCH': {
      if (comp.centre2D) {
        const cp = comp.centre2D;
        let mainStart = cp;
        let mainEnd = cp;
        if (comp.start2D) mainStart = comp.start2D;
        if (comp.end2D) mainEnd = comp.end2D;
        const branchLen = symbolSize * 0.7;
        const branchAngle = comp.start2D ? getAngle(mainStart, mainEnd) + Math.PI / 2 : 0;
        const bx = cp.x + branchLen * Math.cos(branchAngle);
        const by = cp.y + branchLen * Math.sin(branchAngle);
        return (
          <>
            <line
              x1={mainStart.x}
              y1={mainStart.y}
              x2={mainEnd.x}
              y2={mainEnd.y}
              stroke="#2E7D32"
              strokeWidth={strokeW * 1.5}
              strokeLinecap="round"
            />
            <line
              x1={cp.x}
              y1={cp.y}
              x2={bx}
              y2={by}
              stroke="#2E7D32"
              strokeWidth={strokeW * 1.5}
              strokeLinecap="round"
            />
            <circle cx={cp.x} cy={cp.y} r={dim * 0.4} fill="#2E7D32" />
          </>
        );
      }
      if (hasStartEnd) {
        const s = comp.start2D!;
        const e = comp.end2D!;
        const mp = midpoint(s, e);
        const ba = getAngle(s, mp) + Math.PI / 2;
        const bh = symbolSize * 0.6;
        const bx = mp.x + bh * Math.cos(ba);
        const by = mp.y + bh * Math.sin(ba);
        return (
          <>
            <line
              x1={s.x}
              y1={s.y}
              x2={e.x}
              y2={e.y}
              stroke="#2E7D32"
              strokeWidth={strokeW * 1.5}
              strokeLinecap="round"
            />
            <line
              x1={mp.x}
              y1={mp.y}
              x2={bx}
              y2={by}
              stroke="#2E7D32"
              strokeWidth={strokeW * 1.5}
              strokeLinecap="round"
            />
          </>
        );
      }
      return (
        <circle cx={px} cy={py} r={h * 0.5} fill="none" stroke="#2E7D32" strokeWidth={strokeW} />
      );
    }
    case 'VALVE': {
      const material = (comp.materialIdentifier || '').toUpperCase();
      const isButterfly = material.includes('BUTTERFLY') || material.includes('BF');
      if (isButterfly) {
        const dyV = symbolSize * 0.35;
        const dxV = symbolSize * 0.35;
        const ax1 = px + dxV * Math.cos(angle) + dyV * Math.cos(perpAngle);
        const ay1 = py + dxV * Math.sin(angle) + dyV * Math.sin(perpAngle);
        const ax2 = px - dxV * Math.cos(angle) + dyV * Math.cos(perpAngle);
        const ay2 = py - dxV * Math.sin(angle) + dyV * Math.sin(perpAngle);
        const ax3 = px + dxV * Math.cos(angle) - dyV * Math.cos(perpAngle);
        const ay3 = py + dxV * Math.sin(angle) - dyV * Math.sin(perpAngle);
        const ax4 = px - dxV * Math.cos(angle) - dyV * Math.cos(perpAngle);
        const ay4 = py - dxV * Math.sin(angle) - dyV * Math.sin(perpAngle);
        return (
          <>
            <line x1={ax1} y1={ay1} x2={ax4} y2={ay4} stroke="#C62828" strokeWidth={strokeW} />
            <line x1={ax2} y1={ay2} x2={ax3} y2={ay3} stroke="#C62828" strokeWidth={strokeW} />
            <circle cx={px} cy={py} r={dim * 0.2} fill="#C62828" />
          </>
        );
      }
      const halfW = symbolSize * 0.3;
      const gx1 = px + halfW * Math.cos(angle) + dx * 0.5;
      const gy1 = py + halfW * Math.sin(angle) + dy * 0.5;
      const gx2 = px - halfW * Math.cos(angle) + dx * 0.5;
      const gy2 = py - halfW * Math.sin(angle) + dy * 0.5;
      const gx3 = px + dx * 0.5;
      const gy3 = py + dy * 0.5;
      const gx4 = px + halfW * Math.cos(angle) - dx * 0.5;
      const gy4 = py + halfW * Math.sin(angle) - dy * 0.5;
      const gx5 = px - halfW * Math.cos(angle) - dx * 0.5;
      const gy5 = py - halfW * Math.sin(angle) - dy * 0.5;
      const gx6 = px - dx * 0.5;
      const gy6 = py - dy * 0.5;
      return (
        <>
          <polygon points={`${gx1},${gy1} ${gx2},${gy2} ${gx3},${gy3}`} fill="#C62828" />
          <polygon points={`${gx4},${gy4} ${gx5},${gy5} ${gx6},${gy6}`} fill="#C62828" />
        </>
      );
    }
    case 'WELD': {
      if (comp.start2D) {
        const sp = comp.start2D;
        return <circle cx={sp.x} cy={sp.y} r={dim * 0.3} fill="#9E9E9E" />;
      }
      return <circle cx={px} cy={py} r={dim * 0.3} fill="#9E9E9E" />;
    }
    case 'BOLT': {
      return (
        <circle
          cx={px}
          cy={py}
          r={dim * 0.4}
          fill="none"
          stroke="#757575"
          strokeWidth={strokeW}
        />
      );
    }
    case 'OLET': {
      const cr = dim * 0.5;
      return (
        <>
          <circle
            cx={px}
            cy={py}
            r={cr}
            fill="none"
            stroke="#5D4037"
            strokeWidth={strokeW}
          />
          <line x1={px - cr} y1={py} x2={px + cr} y2={py} stroke="#5D4037" strokeWidth={strokeW} />
          <line x1={px} y1={py - cr} x2={px} y2={py + cr} stroke="#5D4037" strokeWidth={strokeW} />
        </>
      );
    }
    case 'NIPPLE': {
      const nw = dim * 0.5;
      const nh = dim * 0.8;
      return (
        <rect
          x={px - nw / 2}
          y={py - nh / 2}
          width={nw}
          height={nh}
          fill="none"
          stroke="#5D4037"
          strokeWidth={strokeW}
        />
      );
    }
    case 'REDUCER': {
      if (hasStartEnd) {
        const s = comp.start2D!;
        const e = comp.end2D!;
        const mp = midpoint(s, e);
        const dirAngle = getAngle(s, mp);
        const rDir = symbolSize * 0.4;
        const rPerp = symbolSize * 0.25;
        const dxD = rDir * Math.cos(dirAngle);
        const dyD = rDir * Math.sin(dirAngle);
        const dxP = rPerp * Math.cos(dirAngle + Math.PI / 2);
        const dyP = rPerp * Math.sin(dirAngle + Math.PI / 2);
        const p1 = `${mp.x - dxD + dxP},${mp.y - dyD + dyP}`;
        const p2 = `${mp.x - dxD - dxP},${mp.y - dyD - dyP}`;
        const p3 = `${mp.x + dxD + dxP * 0.3},${mp.y + dyD + dyP * 0.3}`;
        const p4 = `${mp.x + dxD - dxP * 0.3},${mp.y + dyD - dyP * 0.3}`;
        return (
          <polygon
            points={`${p1} ${p2} ${p3} ${p4}`}
            fill="none"
            stroke="#7B1FA2"
            strokeWidth={strokeW}
          />
        );
      }
      return (
        <polygon
          points={`${px - h},${py - h} ${px - h},${py + h} ${px + h * 0.5},${py} ${px - h},${py - h}`}
          fill="none"
          stroke="#7B1FA2"
          strokeWidth={strokeW}
        />
      );
    }
    case 'CAP': {
      const capR = dim * 0.6;
      return (
        <path
          d={describeArc(px, py, capR, 90, 270)}
          fill="none"
          stroke="#795548"
          strokeWidth={strokeW}
        />
      );
    }
    case 'PLUG': {
      return <circle cx={px} cy={py} r={dim * 0.4} fill="#795548" />;
    }
    case 'INSTRUMENT': {
      return (
        <circle cx={px} cy={py} r={h * 0.6} fill="none" stroke="#F57C00" strokeWidth={strokeW} />
      );
    }
    default: {
      return (
        <polygon
          points={`${px},${py - h} ${px + h * 0.5},${py} ${px},${py + h} ${px - h * 0.5},${py}`}
          fill="none"
          stroke="#78909C"
          strokeWidth={strokeW}
        />
      );
    }
  }
}

function EdgeLine({
  edge,
  strokeW,
}: {
  edge: NormalizedData['edges'][number];
  strokeW: number;
}) {
  const start = edge.start2D;
  const end = edge.end2D;
  const len = distance2D(start, end);
  // Degenerate edges (two components sharing the exact same endpoint) create
  // zero-length lines that can clutter the view. Skip them; the component
  // symbols already mark the connection point.
  if (len < 0.001) return null;
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="#B0BEC5"
      strokeWidth={strokeW}
      strokeDasharray={`${strokeW * 2} ${strokeW * 2}`}
    />
  );
}

export function PcfIsoViewer({
  sessionId,
  unitDisplay,
  projection = 'isometric',
  angle = 30,
  showLabels = true,
  showWeldNumbers = true,
  heightMode,
  height,
}: PcfIsoViewerProps) {
  const { session, components, loading, error } = usePcfData(sessionId);
  const edges = usePcfEdges(components);
  const svgRef = useRef<SVGSVGElement>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, tx: 0, ty: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const data = useMemo(
    () => normalizeData(components, edges, angle),
    [components, edges, angle],
  );
  const { bounds, maxExtent } = data;

  const symbolSize = Math.max(maxExtent * 0.02, 30);
  const strokeW = 2;
  const dim = Math.max(symbolSize * 0.8, 24);
  // Label is drawn INSIDE the content group (so it pans/zooms with the symbols).
  // Convert "desired pixel size" → "viewBox units" so the rendered label is
  // always ~14px tall regardless of the SVG's viewBox-to-container scale.
  //   fontSize_viewBox = desiredPx * viewBox.width / containerPxWidth
  // For unset / pre-mount container, fall back to a sane viewBox default.
  const labelFontSizeVB =
    containerSize.width && bounds.width
      ? 14 * (bounds.width / containerSize.width)
      : Math.max(maxExtent * 0.012, 16);
  const labelOffsetYVB =
    containerSize.width && bounds.width
      ? 18 * (bounds.width / containerSize.width)
      : symbolSize * 0.6;

  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getBaseScale = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return 1;
    return Math.max(bounds.width / rect.width, bounds.height / rect.height);
  }, [bounds.width, bounds.height]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.1, Math.min(20, t.scale * delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setPanning(true);
      setDragStart({ clientX: e.clientX, clientY: e.clientY, tx: transform.x, ty: transform.y });
    }
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panning) {
        const baseScale = getBaseScale();
        const scale = baseScale / transform.scale;
        setTransform((t) => ({
          ...t,
          x: dragStart.tx + (e.clientX - dragStart.clientX) * scale,
          y: dragStart.ty + (e.clientY - dragStart.clientY) * scale,
        }));
      }
    },
    [panning, dragStart, getBaseScale, transform.scale],
  );

  const handleMouseUp = useCallback(() => setPanning(false), []);
  const handleMouseLeave = useCallback(() => setPanning(false), []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const preventDefaultWheel = (e: WheelEvent) => e.preventDefault();
    svg.addEventListener('wheel', preventDefaultWheel, { passive: false });
    return () => svg.removeEventListener('wheel', preventDefaultWheel);
  }, []);

  const handleReset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Container height follows NocoBase block height setting:
  //   specifyValue → exact pixel height from user
  //   fullHeight   → fill whatever BlockItemCard's fullHeight calc gave us (height: '100%')
  //   defaultHeight (or unset) → fall back to a 500px minimum so the diagram is always visible
  const getContainerStyle = useCallback((): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '100%',
      minHeight: 500,
      display: 'flex',
      flexDirection: 'column',
      background: '#fafafa',
      border: '1px solid #e8e8e8',
      borderRadius: 4,
      overflow: 'hidden',
    };
    if (heightMode === 'specifyValue' && typeof height === 'number' && height > 0) {
      return { ...base, height };
    }
    if (heightMode === 'fullHeight') {
      return { ...base, height: '100%' };
    }
    return base;
  }, [heightMode, height]);

  if (loading) {
    return (
      <div
        style={{
          ...getContainerStyle(),
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div style={getContainerStyle()}>
        <Alert message={error} type="error" showIcon style={{ margin: 16 }} />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div style={getContainerStyle()}>
        <Alert
          message={tExpr(
            'No session selected. Please configure the block settings to select a parse session.',
          )}
          type="info"
          showIcon
          style={{ margin: 16 }}
        />
      </div>
    );
  }

  const vb = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  const showEmpty = data.components.length === 0;

  return (
    <div style={getContainerStyle()}>
      {session && (
        <div
          style={{
            padding: '8px 12px',
            background: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
            fontSize: 13,
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span>
            <strong>{session.fileName || session.sessionId}</strong>
          </span>
          {session.unitsCoOrds && <span>Units: {session.unitsCoOrds}</span>}
          <span>Components: {components.length}</span>
          <span>Edges: {edges.length}</span>
          <Space style={{ marginLeft: 'auto' }}>
            <Button size="small" onClick={handleReset}>
              {tExpr('Fit')}
            </Button>
          </Space>
        </div>
      )}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          cursor: panning ? 'grabbing' : 'grab',
          position: 'relative',
          background: '#fff',
        }}
      >
        {showEmpty ? (
          <Alert
            message={tExpr('No components found for this session.')}
            type="info"
            showIcon
            style={{ margin: 16 }}
          />
        ) : (
          <svg
            ref={svgRef}
            viewBox={vb}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', display: 'block' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <style>{`line, circle, rect, path, polygon, text { vector-effect: non-scaling-stroke; }`}</style>
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
              {data.edges.map((edge) => (
                <EdgeLine key={edge.id} edge={edge} strokeW={strokeW} />
              ))}
              {data.components.map((comp) => (
                <ComponentSymbol
                  key={comp.id}
                  comp={comp}
                  symbolSize={symbolSize}
                  strokeW={strokeW}
                  dim={dim}
                />
              ))}
              {showLabels &&
                data.components.map((comp) => (
                  <ComponentLabel
                    key={`lbl-${comp.id}`}
                    comp={comp}
                    fontSize={labelFontSizeVB}
                    offsetY={labelOffsetYVB}
                  />
                ))}
              {showWeldNumbers &&
                data.components.map((comp) => (
                  <WeldNumberLabel
                    key={`weld-${comp.id}`}
                    comp={comp}
                    fontSize={labelFontSizeVB}
                  />
                ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

export default PcfIsoViewer;
