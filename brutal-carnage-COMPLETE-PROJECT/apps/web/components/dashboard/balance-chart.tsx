// components/dashboard/balance-chart.tsx
"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Replace with real data fetched from /api/transactions/history in production.
const MOCK_DATA = [
  { date: "Aug 1", balance: 42000 },
  { date: "Aug 5", balance: 45200 },
  { date: "Aug 10", balance: 43800 },
  { date: "Aug 15", balance: 51000 },
  { date: "Aug 20", balance: 49500 },
  { date: "Aug 25", balance: 56200 },
  { date: "Aug 29", balance: 58900 },
];

export function BalanceChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={MOCK_DATA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
