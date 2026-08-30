// components/dashboard/balance-chart.tsx
"use client";

import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface BalanceHistoryPoint {
  date: string; // ISO timestamp
  balance: number;
}

export interface ActivityHistoryPoint {
  date: string; // YYYY-MM-DD
  moneyDonated: number;
  itemsDonatedValue: number;
  events: number;
}

// Renders the family balance line plus, when provided, daily money
// donated / item-value donated bars and an events-held line — so the
// dashboard's main chart tells the whole "how is the family doing"
// story instead of just the bank balance. `activity` is optional so
// callers that only have balance history (e.g. an older cached page)
// still render fine with just the balance line.
export function BalanceChart({
  history,
  activity,
}: {
  history: BalanceHistoryPoint[];
  activity?: ActivityHistoryPoint[];
}) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Merge balance points onto the activity day-keys when both exist, so
  // everything shares one x-axis. Falls back to balance-only if no
  // activity series was passed in.
  const balanceByDay = new Map<string, number>();
  for (const p of history) {
    balanceByDay.set(new Date(p.date).toISOString().slice(0, 10), p.balance);
  }

  const data = activity && activity.length > 0
    ? activity.map((a) => ({
        date: formatDate(a.date),
        balance: balanceByDay.get(a.date) ?? null,
        moneyDonated: a.moneyDonated,
        itemsDonatedValue: a.itemsDonatedValue,
        events: a.events,
      }))
    : history.map((p) => ({
        date: formatDate(p.date),
        balance: p.balance,
        moneyDonated: null,
        itemsDonatedValue: null,
        events: null,
      }));

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-zinc-600">
        No activity recorded yet.
      </div>
    );
  }

  const hasActivity = activity && activity.length > 0;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DC2626" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#DC2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
        <XAxis dataKey="date" stroke="#52525B" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="money"
          stroke="#52525B"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        {hasActivity && (
          <YAxis
            yAxisId="events"
            orientation="right"
            stroke="#52525B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
        )}
        <Tooltip
          contentStyle={{
            background: "#18181B",
            border: "1px solid #27272A",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "#A1A1AA" }}
          formatter={(value: number, name: string) => {
            if (name === "Events held") return [value, name];
            return [`$${Number(value ?? 0).toLocaleString()}`, name];
          }}
        />
        {hasActivity && <Legend wrapperStyle={{ fontSize: 11, color: "#A1A1AA" }} />}
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="balance"
          name="Balance"
          stroke="#DC2626"
          strokeWidth={2}
          fill="url(#balanceFill)"
          connectNulls
        />
        {hasActivity && (
          <>
            <Bar yAxisId="money" dataKey="moneyDonated" name="Money donated" fill="#22C55E" radius={[3, 3, 0, 0]} barSize={8} />
            <Bar yAxisId="money" dataKey="itemsDonatedValue" name="Items donated (value)" fill="#3B82F6" radius={[3, 3, 0, 0]} barSize={8} />
            <Line
              yAxisId="events"
              type="monotone"
              dataKey="events"
              name="Events held"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
