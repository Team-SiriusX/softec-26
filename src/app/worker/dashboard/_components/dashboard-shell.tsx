'use client';

import { useGetShifts } from '@/app/worker/log-shift/_api/get-shifts';
import { AnomalyAlertCard } from './anomaly-alert-card';
import { CityMedianCard } from './city-median-card';
import { EarningsChart } from './earnings-chart';
import { EffectiveRateCard } from './effective-rate-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { useCurrentUser } from '@/hooks/use-current-user';
import Link from 'next/link';

const statusConfig = {
  PENDING: {
    label: 'Awaiting review',
    icon: Clock,
    className: 'bg-secondary text-secondary-foreground',
  },
  CONFIRMED: {
    label: 'Verified',
    icon: CheckCircle,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  FLAGGED: {
    label: 'Discrepancy flagged',
    icon: AlertTriangle,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  UNVERIFIABLE: {
    label: 'Could not be verified',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive',
  },
} as const;

interface DashboardShellProps {
  category?: string;
  zone?: string;
}

export function DashboardShell({ category, zone }: DashboardShellProps) {
  const { data: user } = useCurrentUser();
  const { data: shiftsData, isLoading: shiftsLoading } = useGetShifts();
  const shifts = shiftsData?.data ?? [];

  // Anomaly data
  const { data: anomalyData } = useQuery({
    queryKey: [QUERY_KEYS.ANOMALY, user?.id],
    queryFn: async () => {
      if (!user?.id) return { anomalies: [] };
      const res = await client.api.anomaly.$post({ json: { workerId: user.id } });
      if (!res.ok) return { anomalies: [] };
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const anomalies = (anomalyData as { anomalies?: unknown[] } | undefined)?.anomalies ?? [];

  // Status counts
  const statusCounts = shifts.reduce(
    (acc, s) => {
      acc[s.verificationStatus] = (acc[s.verificationStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Effective hourly rate (all-time)
  const totalHours = shifts.reduce((sum, s) => sum + Number(s.hoursWorked), 0);
  const totalNet = shifts.reduce((sum, s) => sum + Number(s.netReceived), 0);
  const effectiveHourlyRate = totalHours > 0 ? totalNet / totalHours : null;

  return (
    <div className='space-y-6'>
      {/* Anomaly alert */}
      {anomalies.length > 0 && (
        <AnomalyAlertCard anomalies={anomalies as Parameters<typeof AnomalyAlertCard>[0]['anomalies']} />
      )}

      {/* Summary stat cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
        <EffectiveRateCard />
        <CityMedianCard
          workerHourlyRate={effectiveHourlyRate}
          category={category}
          zone={zone}
        />
      </div>

      {/* Weekly earnings chart */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base font-semibold'>Weekly Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <EarningsChart />
        </CardContent>
      </Card>

      {/* Verification status overview */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base font-semibold'>Verification Status</CardTitle>
          <Link
            href='/worker/earnings'
            className='text-xs text-primary hover:underline'
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {shiftsLoading ? (
            <div className='flex gap-3 flex-wrap'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-7 w-28' />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No shifts logged yet.{' '}
              <Link href='/worker/log-shift' className='text-primary hover:underline'>
                Log your first shift →
              </Link>
            </p>
          ) : (
            <div className='flex flex-wrap gap-3'>
              {Object.entries(statusConfig).map(([status, config]) => {
                const count = statusCounts[status] ?? 0;
                const Icon = config.icon;
                return (
                  <div
                    key={status}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.className}`}
                  >
                    <Icon className='size-3.5' aria-hidden='true' />
                    <span>
                      {count} {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
