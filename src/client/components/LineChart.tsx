/**
 * A small, dependency-free SVG line chart with a snapping crosshair tooltip.
 * One series, one axis, thin line, recessive grid.
 */
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Point {
  x: number;
  y: number;
  label?: ReactNode;
}

interface Props {
  points: Point[];
  height?: number;
  yDomain?: [number, number];
  /** Draw a horizontal reference line (e.g. 1200 baseline or 50%). */
  reference?: { y: number; label: string };
  formatY?: (y: number) => string;
  formatX?: (x: number) => string;
  color?: string;
  /** Fill above/below reference with two tones (for win-probability charts). */
  splitFill?: { above: string; below: string };
  ariaLabel: string;
  step?: boolean;
}

const PAD = { t: 12, r: 12, b: 24, l: 44 };

export default function LineChart({
  points,
  height = 220,
  yDomain,
  reference,
  formatY = (y) => String(Math.round(y)),
  formatX,
  color = 'var(--accent)',
  splitFill,
  ariaLabel,
  step = false,
}: Props) {
  const id = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    let [y0, y1] = yDomain ?? [Math.min(...ys, reference?.y ?? Infinity), Math.max(...ys, reference?.y ?? -Infinity)];
    if (!yDomain) {
      const pad = (y1 - y0) * 0.12 || 10;
      y0 -= pad;
      y1 += pad;
    }
    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
    const sy = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);
    let d = '';
    points.forEach((p, i) => {
      if (i === 0) d += `M${sx(p.x)},${sy(p.y)}`;
      else if (step) d += `H${sx(p.x)}V${sy(p.y)}`;
      else d += `L${sx(p.x)},${sy(p.y)}`;
    });
    const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((y1 - y0) * (i + 0.5)) / 4);
    return { sx, sy, d, ticks, y0, y1 };
  }, [points, yDomain, reference, H, step]);

  if (!geo) return null;
  const { sx, sy, d, ticks } = geo;
  const refY = reference ? sy(reference.y) : null;
  const areaBase = refY ?? H - PAD.b;
  const area = `${d}V${areaBase}H${sx(points[0].x)}Z`;

  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - px) < Math.abs(sx(points[best].x) - px)) best = i;
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={wrap} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <defs>
          {splitFill && refY !== null && (
            <>
              <clipPath id={`above-${id}`}>
                <rect x={0} y={0} width={W} height={refY} />
              </clipPath>
              <clipPath id={`below-${id}`}>
                <rect x={0} y={refY} width={W} height={H} />
              </clipPath>
            </>
          )}
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={PAD.l - 8} y={sy(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
              {formatY(t)}
            </text>
          </g>
        ))}
        {splitFill && refY !== null ? (
          <>
            <path d={area} fill={splitFill.above} opacity={0.22} clipPath={`url(#above-${id})`} />
            <path d={area} fill={splitFill.below} opacity={0.22} clipPath={`url(#below-${id})`} />
          </>
        ) : (
          <path d={area} fill={`url(#fill-${id})`} />
        )}
        {reference && refY !== null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={refY} y2={refY} className="chart-ref" />
            <text x={W - PAD.r} y={refY - 6} textAnchor="end" className="chart-tick">
              {reference.label}
            </text>
          </g>
        )}
        <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {hp && (
          <g>
            <line x1={sx(hp.x)} x2={sx(hp.x)} y1={PAD.t} y2={H - PAD.b} className="chart-crosshair" />
            <circle cx={sx(hp.x)} cy={sy(hp.y)} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: `${(sx(hp.x) / W) * 100}%`, top: `${(sy(hp.y) / H) * 100}%` }}>
          <strong>{formatY(hp.y)}</strong>
          {formatX && <span className="muted">{formatX(hp.x)}</span>}
          {hp.label && <span className="muted">{hp.label}</span>}
        </div>
      )}
    </div>
  );
}
