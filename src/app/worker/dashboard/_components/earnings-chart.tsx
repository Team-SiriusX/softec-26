'use client';

import { useGetShifts } from '@/app/worker/log-shift/_api/get-shifts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

export function EarningsChart() {
  const { data, isLoading } = useGetShifts();
  const shifts = data?.data ?? [];

  const weeklyData = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = startOfWeek(subWeeks(new Date(), 7 - i), { weekStartsOn: 1 });
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end, label: format(start, 'MMM d') };
    });

    return weeks.map(({ start, end, label }) => {
      const weekShifts = shifts.filter((s) => {
        const d = new Date(s.shiftDate);
        return d >= start && d <= end;
      });
      const net = weekShifts.reduce((sum, s) => sum + Number(s.netReceived), 0);
      const hours = weekShifts.reduce((sum, s) => sum + Number(s.hoursWorked), 0);
      return {
        week: label,
        net: Math.round(net),
        hourlyRate: hours > 0 ? Math.round(net / hours) : 0,
      };
    });
  }, [shifts]);

  const chartConfig = {
    net: {
      label: 'Amount received (PKR)',
      color: 'hsl(var(--chart-1))',
    },
  };

  if (isLoading) {
    return <Skeleton className='h-48 w-full' />;
  }

  const hasData = weeklyData.some((w) => w.net > 0);

  if (!hasData) {
    return (
      <div className='flex flex-col items-center justify-center h-48 text-center text-muted-foreground'>
        <p className='text-sm'>No earnings data yet.</p>
        <p className='text-xs mt-1'>Start by logging your first shift.</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className='h-48 w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={weeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id='netGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='var(--color-net)' stopOpacity={0.3} />
              <stop offset='95%' stopColor='var(--color-net)' stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
          <XAxis
            dataKey='week'
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            width={36}
          />
          <ChartTooltip
            content={<ChartTooltipContent formatter={(v) => `PKR ${Number(v).toLocaleString()}`} />}
          />
          <Area
            type='monotone'
            dataKey='net'
            stroke='var(--color-net)'
            fill='url(#netGradient)'
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-net)' }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
