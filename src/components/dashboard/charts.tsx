"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SOURCE_COLOR, SOURCE_LABEL, type SourceKey } from "@/lib/types";
import { useDemo } from "@/store/demo";
import { useMetricScope } from "@/components/metric/MetricProvider";

const axis = { fill: "var(--muted)", fontSize: 11 };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--surface-2)" } };

function useOpenTrace() {
  const { clientId, month } = useMetricScope();
  const set = useDemo((s) => s.setTraceTarget);
  return (traceId: string) => set({ clientId, month, traceId });
}

export function SourceBars({ data }: { data: { source: SourceKey; enquiries: number }[] }) {
  const open = useOpenTrace();
  const rows = data.map((d) => ({ ...d, label: SOURCE_LABEL[d.source] }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 44)} minWidth={0}>
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={88} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        <Bar dataKey="enquiries" radius={[0, 6, 6, 0]} barSize={20} onClick={(d) => open(`source.${(d as unknown as { source: string }).source}.enquiries`)} cursor="pointer" name="Enquiries">
          {rows.map((r) => <Cell key={r.source} fill={SOURCE_COLOR[r.source]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeeklyLine({ data }: { data: { week: string; week_no: number; enquiries: number }[] }) {
  const open = useOpenTrace();
  return (
    <ResponsiveContainer width="100%" height={180} minWidth={0}>
      <LineChart data={data} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="week" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tip} />
        <Line type="monotone" dataKey="enquiries" stroke="var(--neovia-primary)" strokeWidth={2.5} name="Enquiries"
          dot={{ r: 4, cursor: "pointer", onClick: (_e: unknown, p: unknown) => open(`week.${(p as { payload: { week_no: number } }).payload.week_no}.enquiries`) }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SpeedHistogram({ data }: { data: { key: string; label: string; count: number }[] }) {
  const open = useOpenTrace();
  return (
    <ResponsiveContainer width="100%" height={180} minWidth={0}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tip} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Enquiries" cursor="pointer" onClick={(d) => open(`speed.bucket.${(d as unknown as { key: string }).key}`)}>
          {data.map((d, i) => <Cell key={d.key} fill={i <= 1 ? "var(--neovia-accent)" : i === 2 ? "#7dd3c8" : i === 3 ? "#f2c35d" : "#e58b6a"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MedianTrend({ data }: { data: { month: string; label: string; minutes: number }[] }) {
  const open = useOpenTrace();
  return (
    <ResponsiveContainer width="100%" height={180} minWidth={0}>
      <LineChart data={data} margin={{ left: -10, right: 24, top: 22, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} unit="m" />
        <Tooltip {...tip} formatter={(v) => [`${v} min`, "Median reply"]} />
        <ReferenceLine x="Sep" stroke="var(--neovia-accent)" strokeDasharray="4 3"
          label={{ value: "Automation live · 12 Sep", position: "top", fill: "var(--neovia-accent)", fontSize: 11 }} />
        <Line type="monotone" dataKey="minutes" stroke="var(--client-primary)" strokeWidth={2.5} name="Median reply"
          dot={{ r: 5, cursor: "pointer", onClick: (_e: unknown, p: unknown) => open(`trend.median_min.${(p as { payload: { month: string } }).payload.month}`) }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
