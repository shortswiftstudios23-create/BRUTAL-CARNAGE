// components/dashboard/balance-chart.tsx
"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface BalanceHistoryPoint {
  date: string; // ISO timestamp
  balance: number;
}

// Renders whatever history it's given — the dashboard page fetches the
// real series server-side from /api/dashboard/balance-history (backed by
// BalanceSnapshot, written every time the family balance actually
// changes) and passes it in here. This used to be hardcoded mock data,
// which is the "graph isn't accurate" bug that was reported.
export function BalanceChart({ history }: { history: BalanceHistoryPoint[] }) {
  const data = history.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    balance: p.balance,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-zinc-600">
        No balance activity recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DC2626" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#DC2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#52525B"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#52525B"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            background: "#18181B",
            border: "1px solid #27272A",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "#A1A1AA" }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Balance"]}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="#DC2626"
          strokeWidth={2}
          fill="url(#balanceFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
