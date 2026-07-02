import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Spin, Alert } from 'antd';
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
}

interface PcfIsoViewerProps {
  sessionId: string;
  unitDisplay: string;
  model?: unknown;
}

function toSVG(p: { x: number; y: number; z: number }): Point2D {
  return { x: p.x, y: -p.z };
}

function getAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function computeBounds(
  components: PcfComponent[],
  edges: PcfEdge[],
): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const addPoint = (p: Point2D) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };

  for (const comp of components) {
    if (comp.startPoint) addPoint(toSVG(comp.startPoint));
    if (comp.endPoint) addPoint(toSVG(comp.endPoint));
    if (comp.centrePoint) addPoint(toSVG(comp.centrePoint));
  }

  for (const edge of edges) {
    addPoint(toSVG(edge.startPoint));
    addPoint(toSVG(edge.endPoint));
  }

  if (!isFinite(minX)) {
    return { minX: -500, maxX: 500, minY: -500, maxY: 500 };
  }

  const padding = Math.max(maxX - minX, maxY - minY, 1000) * 0.1;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
  };
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number, cy: number, r: number,
  startAngleDeg: number, endAngleDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngleDeg);
  const end = polarToCartesian(cx, cy, r, startAngleDeg);
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function ComponentSymbol({
  comp,
  symbolSize,
  strokeW,
}: {
  comp: PcfComponent;
  symbolSize: number;
  strokeW: number;
}) {
  const type = (comp.componentType || '').toUpperCase();
  const dim = strokeW * 6;

  const hasStartEnd = comp.startPoint && comp.endPoint;
  const hasCentre = !!comp.centrePoint;
  const pos: Point2D | null = hasStartEnd
    ? midpoint(toSVG(comp.startPoint!), toSVG(comp.endPoint!))
    : hasCentre
      ? toSVG(comp.centrePoint!)
      : comp.startPoint
        ? toSVG(comp.startPoint)
        : comp.endPoint
          ? toSVG(comp.endPoint)
          : null;

  const angle = hasStartEnd
    ? getAngle(toSVG(comp.startPoint!), toSVG(comp.endPoint!))
    : 0;

  const px = pos?.x ?? 0;
  const py = pos?.y ?? 0;
  const h = symbolSize * 0.5;
  const perpAngle = angle + Math.PI / 2;
  const dx = h * Math.cos(perpAngle);
  const dy = h * Math.sin(perpAngle);

  switch (type) {
    case 'PIPE': {
      if (comp.startPoint && comp.endPoint) {
        const s = toSVG(comp.startPoint);
        const e = toSVG(comp.endPoint);
        const col =
          comp.pipelineReference?.includes('BRANCH') ||
          comp.pipelineReference?.includes('branch')
            ? '#2196F3'
            : '#1565C0';
        return (
          <line
            x1={s.x} y1={s.y}
            x2={e.x} y2={e.y}
            stroke={col}
            strokeWidth={strokeW * 2}
          />
        );
      }
      return null;
    }
    case 'ELBOW':
    case 'BEND': {
      if (!comp.startPoint || !comp.endPoint) {
        return (
          <circle cx={px} cy={py} r={h * 0.6} fill="none" stroke="#E65100" strokeWidth={strokeW} />
        );
      }
      const startA = getAngle(toSVG(comp.startPoint), pos!);
      const endA = getAngle(pos!, toSVG(comp.endPoint));
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
        />
      );
    }
    case 'FLANGE': {
      return (
        <>
          <line
            x1={px - dx} y1={py - dy}
            x2={px + dx} y2={py + dy}
            stroke="#333"
            strokeWidth={strokeW * 3}
          />
          <rect
            x={px - dx - dim * 0.3} y={py - dy - dim * 0.3}
            width={dim * 0.6} height={dim * 0.6}
            fill="#555"
          />
          <rect
            x={px + dx - dim * 0.3} y={py + dy - dim * 0.3}
            width={dim * 0.6} height={dim * 0.6}
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
            x1={px - gdx} y1={py - gdy}
            x2={px + gdx} y2={py + gdy}
            stroke="#666"
            strokeWidth={strokeW}
          />
          <line
            x1={px - gdx2} y1={py - gdy2}
            x2={px + gdx2} y2={py + gdy2}
            stroke="#666"
            strokeWidth={strokeW}
          />
        </>
      );
    }
    case 'TEE':
    case 'BRANCH': {
      if (comp.centrePoint) {
        const cp = toSVG(comp.centrePoint);
        let mainStart = cp;
        let mainEnd = cp;
        if (comp.startPoint) mainStart = toSVG(comp.startPoint);
        if (comp.endPoint) mainEnd = toSVG(comp.endPoint);
        const branchLen = symbolSize * 0.7;
        const branchAngle = comp.startPoint
          ? getAngle(mainStart, mainEnd) + Math.PI / 2
          : 0;
        const bx = cp.x + branchLen * Math.cos(branchAngle);
        const by = cp.y + branchLen * Math.sin(branchAngle);
        return (
          <>
            <line
              x1={mainStart.x} y1={mainStart.y}
              x2={mainEnd.x} y2={mainEnd.y}
              stroke="#2E7D32"
              strokeWidth={strokeW * 1.5}
            />
            <line
              x1={cp.x} y1={cp.y}
              x2={bx} y2={by}
              stroke="#2E7D32"
              strokeWidth={strokeW * 1.5}
            />
            <circle cx={cp.x} cy={cp.y} r={dim * 0.4} fill="#2E7D32" />
          </>
        );
      }
      if (hasStartEnd) {
        const s = toSVG(comp.startPoint!);
        const e = toSVG(comp.endPoint!);
        const mp = midpoint(s, e);
        const ba = getAngle(s, mp) + Math.PI / 2;
        const bh = symbolSize * 0.6;
        const bx = mp.x + bh * Math.cos(ba);
        const by = mp.y + bh * Math.sin(ba);
        return (
          <>
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#2E7D32" strokeWidth={strokeW * 1.5} />
            <line x1={mp.x} y1={mp.y} x2={bx} y2={by} stroke="#2E7D32" strokeWidth={strokeW * 1.5} />
          </>
        );
      }
      return (
        <circle cx={px} cy={py} r={h * 0.5} fill="none" stroke="#2E7D32" strokeWidth={strokeW} />
      );
    }
    case 'VALVE': {
      const material = (comp.materialIdentifier || '').toUpperCase();
      const isButterfly =
        material.includes('BUTTERFLY') || material.includes('BF');
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
      if (comp.startPoint) {
        const sp = toSVG(comp.startPoint);
        return <circle cx={sp.x} cy={sp.y} r={dim * 0.3} fill="#9E9E9E" />;
      }
      return <circle cx={px} cy={py} r={dim * 0.3} fill="#9E9E9E" />;
    }
    case 'BOLT': {
      return <circle cx={px} cy={py} r={dim * 0.4} fill="none" stroke="#757575" strokeWidth={strokeW} />;
    }
    case 'OLET': {
      const cr = dim * 0.5;
      return (
        <>
          <circle cx={px} cy={py} r={cr} fill="none" stroke="#5D4037" strokeWidth={strokeW} />
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
          x={px - nw / 2} y={py - nh / 2}
          width={nw} height={nh}
          fill="none"
          stroke="#5D4037"
          strokeWidth={strokeW}
        />
      );
    }
    case 'REDUCER': {
      if (hasStartEnd) {
        const s = toSVG(comp.startPoint!);
        const e = toSVG(comp.endPoint!);
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
  edge: PcfEdge;
  strokeW: number;
}) {
  const start = toSVG(edge.startPoint);
  const end = toSVG(edge.endPoint);
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

export function PcfIsoViewer({ sessionId, unitDisplay }: PcfIsoViewerProps) {
  const { session, components, loading, error } = usePcfData(sessionId);
  const edges = usePcfEdges(components);
  const svgRef = useRef<SVGSVGElement>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const bounds = useMemo(() => computeBounds(components, edges), [components, edges]);
  const extentX = bounds.maxX - bounds.minX;
  const extentY = bounds.maxY - bounds.minY;
  const maxExtent = Math.max(extentX, extentY, 1000);
  const symbolSize = maxExtent * 0.03;
  const strokeW = Math.max(0.5, maxExtent * 0.001);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.1, Math.min(20, t.scale * delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panning) {
        setTransform((t) => ({
          ...t,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }));
      }
    },
    [panning, panStart],
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Alert message={error} type="error" showIcon />;
  }

  if (!sessionId) {
    return (
      <Alert
        message={tExpr('No session selected. Please configure the block settings to select a parse session.')}
        type="info"
        showIcon
      />
    );
  }

  const vb = `${bounds.minX} ${bounds.minY} ${extentX} ${extentY}`;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          }}
        >
          <span><strong>{session.fileName || session.sessionId}</strong></span>
          {session.unitsCoOrds && <span>Units: {session.unitsCoOrds}</span>}
          <span>Components: {components.length}</span>
          <span>Edges: {edges.length}</span>
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
        <svg
          ref={svgRef}
          viewBox={vb}
          style={{ width: '100%', height: '100%' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <g
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
            style={{ transformOrigin: '0 0' }}
          >
            {edges.map((edge) => (
              <EdgeLine key={edge.id} edge={edge} strokeW={strokeW} />
            ))}
            {components.map((comp) => (
              <ComponentSymbol
                key={comp.id}
                comp={comp}
                symbolSize={symbolSize}
                strokeW={strokeW}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default PcfIsoViewer;
