"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { AnalyticsSnapshot } from "@/lib/mock/types";

interface Props {
  trend: AnalyticsSnapshot["trend"];
  demand: AnalyticsSnapshot["demandBySkill"];
}

/**
 * Charts isolated in a client island so the page itself stays mostly RSC.
 * Editorial tuning: warm institutional palette, hairline grid, Fraunces tick fonts,
 * accent for placements, ink for registrations. No glow effects, no 3D.
 */
export function InsightsCharts({ trend, demand }: Props) {
  // Recharts' ResponsiveContainer can't measure during SSR  gate to client mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const palette = {
    ink: "#1A1714",
    accent: "#D97A14",
    brand: "#134E48",
    hairline: "#E4DED4",
    stale: "#B45F3C",
    sunk: "#F1EDE6",
  };

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {/* Trend */}
      <figure>
        <figcaption className="mb-3 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              Trend
            </div>
            <h3 className="font-display text-xl">
              Registrations &amp; confirmed placements
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            <Legend dot={palette.ink}>Registrations</Legend>
            <Legend dot={palette.accent}>Placements</Legend>
          </div>
        </figcaption>
        <div className="h-[260px]">
          {!mounted ? (
            <div className="h-full w-full animate-pulse rounded-sm bg-[color:var(--color-surface-sunk)]" />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
              <CartesianGrid stroke={palette.hairline} vertical={false} />
              <XAxis
                dataKey="month"
                stroke={palette.ink}
                tick={{ fill: palette.ink, fontSize: 11 }}
                axisLine={{ stroke: palette.hairline }}
                tickLine={false}
              />
              <YAxis
                stroke={palette.ink}
                tick={{ fill: palette.ink, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: `1px solid ${palette.hairline}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke={palette.ink}
                strokeWidth={2}
                dot={{ r: 2.5, fill: palette.ink }}
              />
              <Line
                type="monotone"
                dataKey="placements"
                stroke={palette.accent}
                strokeWidth={2}
                dot={{ r: 2.5, fill: palette.accent }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </figure>

      {/* Skills gap */}
      <figure>
        <figcaption className="mb-3 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              Demand
            </div>
            <h3 className="font-display text-xl">Skills in demand vs. matches</h3>
          </div>
          <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            <Legend dot={palette.brand}>Searches</Legend>
            <Legend dot={palette.stale}>Matches</Legend>
          </div>
        </figcaption>
        <div className="h-[260px]">
          {!mounted ? (
            <div className="h-full w-full animate-pulse rounded-sm bg-[color:var(--color-surface-sunk)]" />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={demand}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 24 }}
              barCategoryGap={10}
            >
              <CartesianGrid stroke={palette.hairline} horizontal={false} />
              <XAxis
                type="number"
                stroke={palette.ink}
                tick={{ fill: palette.ink, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="skill"
                stroke={palette.ink}
                tick={{ fill: palette.ink, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: `1px solid ${palette.hairline}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="searches" fill={palette.brand} radius={[0, 2, 2, 0]}>
                {demand.map((d, i) => (
                  <Cell key={`s-${i}`} />
                ))}
              </Bar>
              <Bar dataKey="matches" fill={palette.stale} radius={[0, 2, 2, 0]}>
                {demand.map((d, i) => (
                  <Cell key={`m-${i}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          When the teal bar dwarfs the clay bar, that is a national skills gap.
          The biggest gap drives the policy slide.
        </p>
      </figure>
    </div>
  );
}

function Legend({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2 rounded-full" style={{ background: dot }} />
      {children}
    </span>
  );
}
