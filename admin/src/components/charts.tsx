"use client";

import { useId, useMemo, useState } from "react";

/**
 * Small dependency-free SVG charts.
 * Colour rules: categorical slots in fixed order (series-1..3, validated palette), text in
 * ink tokens — never in the series colour; one y-axis; legend for ≥2 series plus direct
 * labels; hover crosshair + tooltip; a table view for screen readers and exact values.
 */

export interface Series {
  key: string;
  label: string;
}

const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 16, right: 120, bottom: 28, left: 44 };

function niceMax(value: number): number {
  if (value <= 0) return 4;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exponent * 4 >= value) ?? 10;
  return step * exponent * 4;
}

/** `xLabels[i]` is the pre-formatted label of `data[i]` — props must be serialisable,
 *  because server components render this client component. */
export function LineChart<T extends Record<string, number | string>>({
  data,
  xLabels,
  series,
  title,
}: {
  data: T[];
  xLabels: string[];
  series: Series[];
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const visible = series.slice(0, SLOTS.length); // >3 series would need folding or facets

  const max = useMemo(
    () => niceMax(Math.max(0, ...data.flatMap((d) => visible.map((s) => Number(d[s.key]) || 0)))),
    [data, visible],
  );
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  if (!data.length) return <p className="py-10 text-center text-sm text-ink-3">No activity in this period.</p>;

  const hovered = hover === null ? null : data[hover];
  const last = data.length - 1;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Legend">
          {visible.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: SLOTS[i] }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs text-info underline-offset-2 hover:underline">
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="text-xs text-ink-3">
              <tr>
                <th className="py-1 text-left font-medium">Date</th>
                {visible.map((s) => <th key={s.key} className="py-1 text-right font-medium">{s.label}</th>)}
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((d) => (
                <tr key={xLabels[data.indexOf(d)]} className="border-t border-line">
                  <td className="py-1">{xLabels[data.indexOf(d)]}</td>
                  {visible.map((s) => <td key={s.key} className="py-1 text-right">{Number(d[s.key]).toLocaleString("en-IN")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}
               onMouseLeave={() => setHover(null)}>
            <title id={titleId}>{title}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--grid)" strokeWidth={1} />
                <text x={PAD.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--text-muted)">
                  {t.toLocaleString("en-IN")}
                </text>
              </g>
            ))}
            {[0, Math.floor(last / 2), last].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
              <text key={i} x={xAt(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {xLabels[i]}
              </text>
            ))}
            {hovered ? (
              <line x1={xAt(hover!)} x2={xAt(hover!)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 3" />
            ) : null}
            {visible.map((s, i) => {
              const path = data.map((d, j) => `${j ? "L" : "M"}${xAt(j)},${yAt(Number(d[s.key]) || 0)}`).join(" ");
              const end = Number(data[last]![s.key]) || 0;
              return (
                <g key={s.key}>
                  <path d={path} fill="none" stroke={SLOTS[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {hovered ? (
                    <circle cx={xAt(hover!)} cy={yAt(Number(hovered[s.key]) || 0)} r={4} fill={SLOTS[i]} stroke="var(--surface-1)" strokeWidth={2} />
                  ) : null}
                  {/* Direct label at the line end, in ink — the dot beside it carries identity. */}
                  <circle cx={xAt(last) + 8} cy={yAt(end)} r={3} fill={SLOTS[i]} />
                  <text x={xAt(last) + 14} y={yAt(end)} dominantBaseline="middle" fontSize={11} fill="var(--text-secondary)">
                    {s.label}
                  </text>
                </g>
              );
            })}
            {/* Wide invisible hit areas: one per x position. */}
            {data.map((_, i) => (
              <rect key={i} x={xAt(i) - innerW / Math.max(data.length, 2) / 2} y={PAD.top}
                    width={innerW / Math.max(data.length - 1, 1)} height={innerH} fill="transparent"
                    onMouseEnter={() => setHover(i)} />
            ))}
          </svg>
          {hovered ? (
            <div className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface-1 px-3 py-2 text-xs shadow-sm"
                 style={{ left: `min(calc(${(xAt(hover!) / WIDTH) * 100}% + 12px), calc(100% - 180px))` }}>
              <p className="mb-1 font-medium text-ink">{xLabels[hover!]}</p>
              {visible.map((s, i) => (
                <p key={s.key} className="tabular flex items-center gap-2 text-ink-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: SLOTS[i] }} aria-hidden />
                  {s.label}: <span className="font-medium text-ink">{Number(hovered[s.key]).toLocaleString("en-IN")}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Single-series ranked magnitudes: horizontal bars, value labels in ink. */
/** Items carry their display `label` (pre-formatted on the server). */
export function BarList({ items, label }: { items: { key: string; label?: string; count: number }[]; label: string }) {
  const formatKey = (key: string) => items.find((i) => i.key === key)?.label ?? key;
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-3">No data yet.</p>;
  return (
    <ul className="space-y-2" aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(6rem,10rem)_1fr_4rem] items-center gap-3 text-sm"
            onMouseEnter={() => setHover(item.key)} onMouseLeave={() => setHover(null)}
            title={`${formatKey(item.key)}: ${item.count.toLocaleString("en-IN")} (${Math.round((item.count / total) * 100)}%)`}>
          <span className="truncate text-ink-2">{formatKey(item.key)}</span>
          <span className="h-3 rounded-r bg-surface-2">
            <span className="block h-3 rounded-r transition-opacity"
                  style={{ width: `${(item.count / max) * 100}%`, background: "var(--series-1)", opacity: hover && hover !== item.key ? 0.45 : 1 }} />
          </span>
          <span className="tabular text-right text-ink">{item.count.toLocaleString("en-IN")}</span>
        </li>
      ))}
    </ul>
  );
}
