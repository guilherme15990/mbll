import {
  CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TrendPoint } from "../lib/api";

const AX = { stroke: "#33456b", fontSize: 11 };
const TIP = { backgroundColor: "#0d1528", border: "1px solid #1e2a4a", borderRadius: 10, fontSize: 12 };

/** Sparkline SVG pura (leve, nítida). */
export function Spark({ data, stroke = "#f0b429", w = 120, h = 34 }: { data: number[]; stroke?: string; w?: number; h?: number }) {
  const xs = data.filter((v) => Number.isFinite(v));
  if (xs.length < 2) return <span className="text-mist text-xs">—</span>;
  const lo = Math.min(...xs), hi = Math.max(...xs), span = hi - lo || 1;
  const pts = xs.map((v, i) => `${(i / (xs.length - 1)) * (w - 4) + 2},${h - 4 - ((v - lo) / span) * (h - 8)}`).join(" ");
  const last = pts.split(" ").pop()!.split(",");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={stroke} />
    </svg>
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const rows = [...data].reverse().map((p) => ({ ...p, winPct: p.win * 100, banPct: p.ban * 100 }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#16203a" vertical={false} />
        <XAxis dataKey="date" tick={AX} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tick={AX} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
        <Tooltip contentStyle={TIP} formatter={(v: any, n: any) => [`${Number(v).toFixed(2)}%`, n === "winPct" ? "win" : "ban"]} />
        <Line type="monotone" dataKey="winPct" name="winPct" stroke="#f0b429" strokeWidth={2.2} dot={false} />
        <Line type="monotone" dataKey="banPct" name="banPct" stroke="#7c8db0" strokeWidth={1.4} dot={false} strokeDasharray="5 4" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DurationChart({ curve, heroWin }: { curve: { label: string; win: number }[]; heroWin: number }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={curve} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#16203a" vertical={false} />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={false} interval={1} />
        <YAxis tick={AX} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip contentStyle={TIP} formatter={(v: any) => [`${(Number(v) * 100).toFixed(1)}%`, "win"]} />
        <ReferenceLine y={heroWin} stroke="#8ea0c2" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="win" stroke="#22d3ee" strokeWidth={2.2} dot={{ r: 2.5, fill: "#22d3ee" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** @deprecated Quadrant removido na Wave 0 IDD v4 — código morto (nenhum uso). Mantido como stub para compat de import. */
export function Quadrant(_props: { data: { id: number; name: string; presence: number; wrAdj: number }[]; avg: number }) {
  return null;
}

/** PRD Draft RF-DIST-02: Matrizes 2D de Força Estimada vs Pressão (Pick ou Ban separadas). */
export function PressureScatter({
  data,
  pressureKey,
  pressureLabel,
  color = "#f0b429",
  avgStrength,
  medianPressure,
}: {
  data: { id: number; name: string; wrAdj: number; pick: number; ban: number }[];
  pressureKey: "pick" | "ban";
  pressureLabel: string;
  color?: string;
  avgStrength: number;
  medianPressure: number;
}) {
  const chartData = data.map((d) => ({
    name: d.name,
    wrAdj: d.wrAdj,
    pressure: d[pressureKey],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 10, right: 14, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#16203a" />
        <XAxis
          dataKey="wrAdj"
          name="Força Estimada (θ̂)"
          tick={AX}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
        />
        <YAxis
          dataKey="pressure"
          name={pressureLabel}
          tick={AX}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
        />
        <Tooltip
          contentStyle={TIP}
          cursor={{ stroke: "#33456b" }}
          formatter={(v: any, name: any) => [
            `${(Number(v) * 100).toFixed(2)}%`,
            name === "pressure" ? pressureLabel : "θ̂ (Força)",
          ]}
        />
        <ReferenceLine x={avgStrength} stroke="#33456b" strokeDasharray="4 4" />
        <ReferenceLine y={medianPressure} stroke="#33456b" strokeDasharray="4 4" />
        <Scatter data={chartData} fill={color} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
