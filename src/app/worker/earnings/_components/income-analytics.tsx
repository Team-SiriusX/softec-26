'use client';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfWeek, subWeeks, startOfMonth, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

type Shift = {
  shiftDate: string | Date;
  netReceived: string | number;
  hoursWorked: string | number;
  grossEarned: string | number;
  platformDeductions: string | number;
  platform: { name: string };
  verificationStatus: string;
};

interface IncomeAnalyticsProps {
  shifts: Shift[];
  isLoading: boolean;
  category?: string;
  zone?: string;
}

const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

type Period = (typeof PERIOD_OPTIONS)[number]['value'];

function useWeeklyData(shifts: Shift[], weeksBack = 12) {
  return useMemo(() => {
    const weeks = Array.from({ length: weeksBack }, (_, i) => {
      const start = startOfWeek(subWeeks(new Date(), weeksBack - 1 - i), {
        weekStartsOn: 1,
      });
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end, label: format(start, 'MMM d') };
    });

    return weeks.map(({ start, end, label }) => {
      const ws = shifts.filter((s) => {
        const d = new Date(s.shiftDate);
        return d >= start && d <= end;
      });
      const net = ws.reduce((sum, s) => sum + Number(s.netReceived), 0);
      const hours = ws.reduce((sum, s) => sum + Number(s.hoursWorked), 0);
      const deductions = ws.reduce((sum, s) => sum + Number(s.platformDeductions), 0);
      const gross = ws.reduce((sum, s) => sum + Number(s.grossEarned), 0);
      return {
        period: label,
        net: Math.round(net),
        hourlyRate: hours > 0 ? Math.round(net / hours) : 0,
        commissionPct: gross > 0 ? Math.round((deductions / gross) * 100) : 0,
      };
    });
  }, [shifts, weeksBack]);
}

function useMonthlyData(shifts: Shift[], monthsBack = 6) {
  return useMemo(() => {
    const months = Array.from({ length: monthsBack }, (_, i) => {
      const start = startOfMonth(subMonths(new Date(), monthsBack - 1 - i));
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { start, end, label: format(start, 'MMM yyyy') };
    });

    return months.map(({ start, end, label }) => {
      const ms = shifts.filter((s) => {
        const d = new Date(s.shiftDate);
        return d >= start && d <= end;
      });
      const net = ms.reduce((sum, s) => sum + Number(s.netReceived), 0);
      const hours = ms.reduce((sum, s) => sum + Number(s.hoursWorked), 0);
      const deductions = ms.reduce((sum, s) => sum + Number(s.platformDeductions), 0);
      const gross = ms.reduce((sum, s) => sum + Number(s.grossEarned), 0);
      return {
        period: label,
        net: Math.round(net),
        hourlyRate: hours > 0 ? Math.round(net / hours) : 0,
        commissionPct: gross > 0 ? Math.round((deductions / gross) * 100) : 0,
      };
    });
  }, [shifts, monthsBack]);
}

function EmptyChart() {
  return (
    <div className='flex items-center justify-center h-48 text-sm text-muted-foreground'>
      Not enough data yet — keep logging shifts to see trends here.
    </div>
  );
}

function NetEarningsChart({
  data,
}: {
  data: { period: string; net: number }[];
}) {
  const hasData = data.some((d) => d.net > 0);
  if (!hasData) return <EmptyChart />;

  return (
    <ChartContainer
      config={{ net: { label: 'Amount received (PKR)', color: 'hsl(var(--chart-1))' } }}
      className='h-48 w-full'
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
          <XAxis dataKey='period' tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `PKR ${Number(v).toLocaleString()}`} />} />
          <Line type='monotone' dataKey='net' stroke='var(--color-net)' strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function HourlyRateChart({
  data,
}: {
  data: { period: string; hourlyRate: number }[];
}) {
  const hasData = data.some((d) => d.hourlyRate > 0);
  if (!hasData) return <EmptyChart />;

  return (
    <ChartContainer
      config={{ hourlyRate: { label: 'Effective rate (PKR/hr)', color: 'hsl(var(--chart-2))' } }}
      className='h-48 w-full'
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
          <XAxis dataKey='period' tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `PKR ${Number(v).toLocaleString()}/hr`} />} />
          <Line type='monotone' dataKey='hourlyRate' stroke='var(--color-hourlyRate)' strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function CommissionChart({
  data,
}: {
  data: { period: string; commissionPct: number }[];
}) {
  const hasData = data.some((d) => d.commissionPct > 0);
  if (!hasData) return <EmptyChart />;

  return (
    <ChartContainer
      config={{ commissionPct: { label: 'Platform commission (%)', color: 'hsl(var(--chart-3))' } }}
      className='h-48 w-full'
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
          <XAxis dataKey='period' tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36}
            tickFormatter={(v) => `${v}%`} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${Number(v)}%`} />} />
          <Line type='monotone' dataKey='commissionPct' stroke='var(--color-commissionPct)' strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

export function IncomeAnalytics({ shifts, isLoading }: IncomeAnalyticsProps) {
  const [period, setPeriod] = useState<Period>('weekly');

  const weeklyData = useWeeklyData(shifts);
  const monthlyData = useMonthlyData(shifts);
  const data = period === 'weekly' ? weeklyData : monthlyData;

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-48 w-full' />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Period toggle */}
      <div className='flex items-center gap-2'>
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-pressed={period === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue='net'>
        <TabsList className='mb-4'>
          <TabsTrigger value='net'>Earnings</TabsTrigger>
          <TabsTrigger value='rate'>Hourly Rate</TabsTrigger>
          <TabsTrigger value='commission'>Commission %</TabsTrigger>
        </TabsList>

        <TabsContent value='net'>
          <p className='text-xs text-muted-foreground mb-3'>
            Total amount received ({period === 'weekly' ? 'last 12 weeks' : 'last 6 months'})
          </p>
          <NetEarningsChart data={data} />
        </TabsContent>

        <TabsContent value='rate'>
          <p className='text-xs text-muted-foreground mb-3'>
            Average earnings per hour worked
          </p>
          <HourlyRateChart data={data} />
        </TabsContent>

        <TabsContent value='commission'>
          <p className='text-xs text-muted-foreground mb-3'>
            Platform commission as a percentage of total earned
          </p>
          <CommissionChart data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
