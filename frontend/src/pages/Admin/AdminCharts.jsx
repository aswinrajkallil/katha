import React, { useMemo, useState } from "react";
import { formatNumber } from "./AdminShared";

// Dependency-free SVG charts. Colours are chosen to stay distinguishable without relying on hue alone
// (series also differ by dash pattern) and each chart exposes its data as a text table for screen readers.

const W = 600;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 38 };
const PALETTE = ["#e8590c", "#2563eb", "#059669", "#7c3aed"];
const DASH = ["", "6 4", "2 3", "8 3 2 3"];

const niceMax = (max) => {
  if (max <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

const shortDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
};

/**
 * @param points  [{ date: "YYYY-MM-DD", ...numbers }]
 * @param series  [{ key, label }]
 */
export function LineChart({ title, subtitle, points = [], series, empty = "No data for this period" }) {
  const [hover, setHover] = useState(null);

  const geometry = useMemo(() => {
    const max = niceMax(Math.max(0, ...points.flatMap((p) => series.map((s) => p[s.key] || 0))));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v) => PAD.top + innerH - (v / max) * innerH;
    return { max, x, y, innerH };
  }, [points, series]);

  const total = points.reduce((sum, p) => sum + series.reduce((s, ser) => s + (p[ser.key] || 0), 0), 0);
  const hasData = points.length > 0 && total > 0;
  const ticks = [0, 0.5, 1].map((f) => Math.round(geometry.max * f));
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="ax-chart" style={{ margin: 0 }}>
      {title && <figcaption className="ax-chart-title">{title}</figcaption>}
      {subtitle && <p className="ax-chart-sub">{subtitle}</p>}
      {!hasData ? (
        <div className="ax-chart-empty">{empty}</div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${title}: ${series.map((s) => `${s.label} total ${formatNumber(points.reduce((a, p) => a + (p[s.key] || 0), 0))}`).join(", ")}`}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={geometry.y(t)} y2={geometry.y(t)} stroke="#e2e8f0" />
                <text x={PAD.left - 6} y={geometry.y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {t}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text key={p.date} x={geometry.x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#64748b">
                  {shortDate(p.date)}
                </text>
              ) : null
            )}
            {series.map((s, si) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={PALETTE[si % PALETTE.length]}
                strokeWidth="2.2"
                strokeDasharray={DASH[si % DASH.length]}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points.map((p, i) => `${geometry.x(i)},${geometry.y(p[s.key] || 0)}`).join(" ")}
              />
            ))}
            {active && (
              <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1={PAD.top} y2={PAD.top + geometry.innerH} stroke="#94a3b8" strokeDasharray="3 3" />
            )}
            {points.map((p, i) => {
              const step = (W - PAD.left - PAD.right) / Math.max(1, points.length - 1);
              return (
                <rect
                  key={p.date}
                  x={geometry.x(i) - step / 2}
                  y={PAD.top}
                  width={step}
                  height={geometry.innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                />
              );
            })}
          </svg>
          <div className="ax-chart-legend" aria-live="polite">
            {series.map((s, si) => (
              <span key={s.key}>
                <i style={{ background: PALETTE[si % PALETTE.length] }} />
                {s.label}
                {active ? `: ${formatNumber(active[s.key] || 0)}` : ""}
              </span>
            ))}
            {active && <span className="ax-muted">{shortDate(active.date)}</span>}
          </div>
          <table className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th>Date</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  {series.map((s) => (
                    <td key={s.key}>{p[s.key] || 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

/** Horizontal bars for ranked lists. items: [{ label, value, sub? }] */
export function BarList({ title, subtitle, items = [], empty = "No data for this period", format = formatNumber }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="ax-chart">
      {title && <h3 className="ax-chart-title">{title}</h3>}
      {subtitle && <p className="ax-chart-sub">{subtitle}</p>}
      {items.length === 0 ? (
        <div className="ax-chart-empty">{empty}</div>
      ) : (
        <div className="ax-bars" role="list">
          {items.map((item) => (
            <div className="ax-bar-row" role="listitem" key={item.key || item.label}>
              <span className="ax-bar-label" title={item.label}>
                {item.label}
                {item.sub && <span className="ax-muted"> · {item.sub}</span>}
              </span>
              <span className="ax-bar-track" aria-hidden="true">
                <span className="ax-bar-fill" style={{ width: `${(item.value / max) * 100}%`, display: "block" }} />
              </span>
              <strong>{format(item.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="ax-stat">
      <span className="ax-stat-label">{label}</span>
      <span className="ax-stat-value">{typeof value === "number" ? formatNumber(value) : value}</span>
      {sub && <span className="ax-stat-sub">{sub}</span>}
    </div>
  );
}
