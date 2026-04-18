'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetShifts } from '@/app/worker/log-shift/_api/get-shifts';
import { startOfWeek, isAfter } from 'date-fns';
import { BadgeCheck, Clock, TrendingUp } from 'lucide-react';

export function EffectiveRateCard() {
  const { data, isLoading } = useGetShifts();
  const shifts = data?.data ?? [];

  // This week's net earnings
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekShifts = shifts.filter((s) =>
    isAfter(new Date(s.shiftDate), weekStart),
  );
  const thisWeekNet = thisWeekShifts.reduce(
    (sum, s) => sum + Number(s.netReceived),
    0,
  );

  // Total verified earnings
  const totalVerified = shifts
    .filter((s) => s.verificationStatus === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.netReceived), 0);

  // Effective hourly rate (all-time)
  const totalHours = shifts.reduce((sum, s) => sum + Number(s.hoursWorked), 0);
  const totalNet = shifts.reduce((sum, s) => sum + Number(s.netReceived), 0);
  const effectiveRate = totalHours > 0 ? totalNet / totalHours : null;

  const stats = [
    {
      label: "This week's earnings",
      value:
        thisWeekNet > 0
          ? `PKR ${thisWeekNet.toLocaleString()}`
          : 'No shifts this week',
      icon: TrendingUp,
      sub: `${thisWeekShifts.length} shift${thisWeekShifts.length !== 1 ? 's' : ''}`,
    },
    {
      label: 'Total verified earnings',
      value:
        totalVerified > 0
          ? `PKR ${totalVerified.toLocaleString()}`
          : 'None verified yet',
      icon: BadgeCheck,
      sub: `${shifts.filter((s) => s.verificationStatus === 'CONFIRMED').length} verified shifts`,
    },
    {
      label: 'Effective hourly rate',
      value:
        effectiveRate !== null
          ? `PKR ${Math.round(effectiveRate).toLocaleString()}/hr`
          : '—',
      icon: Clock,
      sub: `${totalHours.toFixed(1)} total hours logged`,
    },
  ];

  return (
    <>
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className='pb-2'>
                <Skeleton className='h-4 w-32' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-7 w-40 mb-2' />
                <Skeleton className='h-3 w-24' />
              </CardContent>
            </Card>
          ))
        : stats.map(({ label, value, icon: Icon, sub }) => (
            <Card key={label}>
              <CardHeader className='pb-2 flex flex-row items-center justify-between space-y-0'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  {label}
                </CardTitle>
                <Icon className='size-4 text-muted-foreground' aria-hidden='true' />
              </CardHeader>
              <CardContent>
                <p className='text-2xl font-bold tabular-nums'>{value}</p>
                <p className='text-xs text-muted-foreground mt-1'>{sub}</p>
              </CardContent>
            </Card>
          ))}
    </>
  );
}
