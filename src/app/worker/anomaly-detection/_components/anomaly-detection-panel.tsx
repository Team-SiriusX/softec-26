'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  CheckCircle2,
  Clock3,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Waves,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { QUERY_KEYS } from '@/constants/query-keys';
import { useCurrentUser } from '@/hooks/use-current-user';
import { client } from '@/lib/hono';
import { cn } from '@/lib/utils';

const severityOrder = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

const severityTone = {
  critical: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-50',
  high: 'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-50',
  medium: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-50',
  low: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-50',
} as const;

const severityIcon = {
  critical: TriangleAlert,
  high: AlertTriangle,
  medium: BadgeAlert,
  low: CheckCircle2,
} as const;

const shiftResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      shiftDate: z.string().or(z.date()),
      platform: z.object({
        name: z.string(),
      }),
      hoursWorked: z.union([z.string(), z.number()]),
      grossEarned: z.union([z.string(), z.number()]),
      platformDeductions: z.union([z.string(), z.number()]),
      netReceived: z.union([z.string(), z.number()]),
      verificationStatus: z.enum(['PENDING', 'CONFIRMED', 'FLAGGED', 'UNVERIFIABLE']),
    }),
  ),
});

type ShiftRow = z.infer<typeof shiftResponseSchema>['data'][number];

type AnomalyResult = {
  type: string;
  severity: keyof typeof severityTone;
  explanation: string;
};

type AnomalyDetectResponse = {
  anomalies?: AnomalyResult[];
  flags?: AnomalyResult[];
  analyzedShifts?: number;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-PK', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function computeRate(shift: ShiftRow): number {
  const hours = Number(shift.hoursWorked);
  if (hours <= 0) {
    return 0;
  }

  return Number(shift.netReceived) / hours;
}

export default function AnomalyDetectionPanel({ workerId }: { workerId: string }) {
  const { user } = useCurrentUser();
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const currentCityZone = user && 'cityZone' in user ? user.cityZone : null;

  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  }, []);

  const { data: shiftsResponse, isLoading: shiftsLoading } = useQuery({
    queryKey: [QUERY_KEYS.SHIFTS, { workerId, from: ninetyDaysAgo }],
    queryFn: async () => {
      const response = await client.api.shifts.$get({
        query: {
          from: ninetyDaysAgo,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent shifts');
      }

      const data: unknown = await response.json();
      return shiftResponseSchema.parse(data);
    },
  });

  const shifts = shiftsResponse?.data ?? [];

  const detectionMutation = useMutation({
    mutationFn: async () => {
      const response = await client.api.anomaly.detect.$post({
        json: { workerId },
      });

      if (!response.ok) {
        throw new Error('Anomaly detection failed');
      }

      return (await response.json()) as AnomalyDetectResponse;
    },
    onSuccess: () => {
      setSubmittedAt(new Date().toISOString());
    },
  });

  const anomalies = detectionMutation.data?.anomalies ?? detectionMutation.data?.flags ?? [];
  const sortedAnomalies = useMemo(
    () =>
      [...anomalies].sort(
        (left, right) => severityOrder[right.severity] - severityOrder[left.severity],
      ),
    [anomalies],
  );

  const totalNet = useMemo(
    () => shifts.reduce((sum, shift) => sum + Number(shift.netReceived), 0),
    [shifts],
  );
  const totalDeductions = useMemo(
    () => shifts.reduce((sum, shift) => sum + Number(shift.platformDeductions), 0),
    [shifts],
  );
  const averageRate = useMemo(() => {
    if (shifts.length === 0) {
      return 0;
    }

    return shifts.reduce((sum, shift) => sum + computeRate(shift), 0) / shifts.length;
  }, [shifts]);
  const averageDeductionRate = useMemo(() => {
    const gross = shifts.reduce((sum, shift) => sum + Number(shift.grossEarned), 0);
    if (gross <= 0) {
      return 0;
    }

    return (totalDeductions / gross) * 100;
  }, [shifts, totalDeductions]);

  const highestAnomaly = sortedAnomalies[0];
  const hasAnomalies = sortedAnomalies.length > 0;
  const analyzedShifts = detectionMutation.data?.analyzedShifts ?? shifts.length;

  return (
    <div className='space-y-6'>
      <section className='relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-950/20 lg:p-8'>
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.18),_transparent_34%)]' />
        <div className='relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge className='border-0 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white'>
                Problem statement feature
              </Badge>
              <Badge className='border-0 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100'>
                90-day earnings scan
              </Badge>
            </div>
            <div className='max-w-3xl space-y-3'>
              <h1 className='text-3xl font-black tracking-tight text-white lg:text-4xl'>
                Anomaly detection
              </h1>
              <p className='max-w-2xl text-sm text-slate-300 sm:text-base'>
                FairGig checks your recent earnings for unusual deductions or sudden
                income drops, then explains the issue in plain language so you can
                decide what to verify or dispute.
              </p>
            </div>
            <div className='flex flex-wrap gap-2 text-xs text-slate-300'>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                <Sparkles className='size-3.5' aria-hidden='true' />
                Transparent detection, not hidden scoring
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                <Waves className='size-3.5' aria-hidden='true' />
                Uses your logged shift history
              </span>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[380px] lg:grid-cols-1 xl:grid-cols-3'>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Logged shifts
              </p>
              <p className='mt-1 text-2xl font-bold text-white'>{shifts.length}</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Avg. rate/hr
              </p>
              <p className='mt-1 text-2xl font-bold text-white'>{formatMoney(averageRate)}</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Deduction rate
              </p>
              <p className='mt-1 text-2xl font-bold text-white'>{averageDeductionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </section>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]'>
        <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
          <CardHeader className='space-y-3'>
            <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <CardTitle className='text-xl'>Run detection</CardTitle>
                <CardDescription>
                  Scans the latest 90 days of logged shifts for anomalies.
                </CardDescription>
              </div>
              <Badge variant='outline' className='w-fit gap-1.5'>
                <Clock3 className='size-3.5' aria-hidden='true' />
                {submittedAt ? `Last run ${new Intl.DateTimeFormat('en-PK', { timeStyle: 'short', dateStyle: 'medium' }).format(new Date(submittedAt))}` : 'Not run yet'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
                <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                  Window
                </p>
                <p className='mt-1 text-sm font-medium'>Last 90 days</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
                <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                  Shifts analyzed
                </p>
                <p className='mt-1 text-sm font-medium'>{analyzedShifts}</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
                <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                  Total net earnings
                </p>
                <p className='mt-1 text-sm font-medium'>{formatMoney(totalNet)}</p>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <Button
                onClick={() => detectionMutation.mutate()}
                disabled={detectionMutation.isPending || shiftsLoading || shifts.length === 0}
                className='gap-2'
              >
                {detectionMutation.isPending ? 'Analyzing...' : 'Run anomaly check'}
                <ArrowRight className='size-4' aria-hidden='true' />
              </Button>
              <p className='text-sm text-muted-foreground'>
                The system will only flag unusual patterns it can explain.
              </p>
            </div>

            {detectionMutation.isPending && (
              <div className='space-y-3'>
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className='h-24 w-full rounded-2xl' />
                ))}
              </div>
            )}

            {!detectionMutation.isPending && detectionMutation.isError && (
              <div className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'>
                <p className='text-sm font-medium'>Unable to run anomaly detection right now.</p>
              </div>
            )}

            {!detectionMutation.isPending && !hasAnomalies && detectionMutation.isSuccess && (
              <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'>
                <div className='flex items-start gap-3'>
                  <CheckCircle2 className='mt-0.5 size-5 shrink-0' aria-hidden='true' />
                  <div>
                    <p className='font-semibold'>No unusual patterns were detected.</p>
                    <p className='mt-1 text-sm leading-relaxed'>
                      Your recent earnings look consistent enough for the model to stay quiet.
                      If a platform changes deductions later, run this again after logging new shifts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!detectionMutation.isPending && hasAnomalies && (
              <div className='space-y-4'>
                {sortedAnomalies.map((anomaly, index) => {
                  const Icon = severityIcon[anomaly.severity];

                  return (
                    <div
                      key={`${anomaly.type}-${index}`}
                      className={cn('rounded-2xl border px-4 py-4', severityTone[anomaly.severity])}
                    >
                      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='flex items-start gap-3'>
                          <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/70'>
                            <Icon className='size-5' aria-hidden='true' />
                          </div>
                          <div>
                            <div className='flex flex-wrap items-center gap-2'>
                              <h3 className='text-sm font-semibold capitalize'>{anomaly.type.replace(/[_-]/g, ' ')}</h3>
                              <Badge variant='outline' className='border-current/20 bg-background/70 text-[11px] uppercase tracking-[0.18em]'>
                                {anomaly.severity}
                              </Badge>
                            </div>
                            <p className='mt-2 text-sm leading-relaxed opacity-95'>
                              {anomaly.explanation}
                            </p>
                          </div>
                        </div>

                        <Badge className='w-fit border-current/20 bg-background/60 text-current'>
                          {index === 0 ? 'Top signal' : 'Additional signal'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className='space-y-6'>
          <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
            <CardHeader>
              <CardTitle className='text-base'>What the model looks for</CardTitle>
              <CardDescription>
                This mirrors the problem statement requirement: unusual deductions and sudden income drops.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <TrendingDown className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Sudden income drops compared with your own recent shift history.
                </p>
              </div>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <TrendingUp className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Unexpected deductions or commission changes that do not fit the normal pattern.
                </p>
              </div>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <Sparkles className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Human-readable explanations that a non-technical worker can understand.
                </p>
              </div>

              <Separator />

              <div className='rounded-2xl border border-border/60 px-4 py-4'>
                <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                  Current context
                </p>
                <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
                  {currentCityZone
                    ? `You are being compared against workers in ${currentCityZone}.`
                    : 'Set your profile city zone to improve anomaly context and local comparisons.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
            <CardHeader>
              <CardTitle className='text-base'>Next steps</CardTitle>
              <CardDescription>
                What to do when the check returns a signal.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-start gap-3 rounded-2xl border border-border/60 px-4 py-3'>
                <div className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  1
                </div>
                <p className='text-sm text-muted-foreground'>
                  Cross-check the flagged shifts in your earnings history.
                </p>
              </div>
              <div className='flex items-start gap-3 rounded-2xl border border-border/60 px-4 py-3'>
                <div className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  2
                </div>
                <p className='text-sm text-muted-foreground'>
                  Upload a screenshot in the earnings flow if you want a verifier to review it.
                </p>
              </div>
              <div className='flex items-start gap-3 rounded-2xl border border-border/60 px-4 py-3'>
                <div className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  3
                </div>
                <p className='text-sm text-muted-foreground'>
                  If the issue looks systemic, post it to the grievance board for advocate review.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
        <CardHeader>
          <CardTitle className='text-base'>Recent earnings context</CardTitle>
          <CardDescription>
            These are the shifts the anomaly scan uses as input.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shiftsLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className='h-14 w-full rounded-2xl' />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground'>
              No shifts are available yet. Log earnings first so anomaly detection has data to analyze.
            </div>
          ) : (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {shifts.slice(-6).reverse().map((shift) => {
                const rate = computeRate(shift);

                return (
                  <div key={shift.id} className='rounded-2xl border border-border/60 px-4 py-3'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-sm font-medium'>{shift.platform.name}</p>
                        <p className='text-xs text-muted-foreground'>{formatDate(shift.shiftDate)}</p>
                      </div>
                      <Badge variant='outline'>{shift.verificationStatus}</Badge>
                    </div>
                    <Separator className='my-3' />
                    <div className='grid grid-cols-2 gap-3 text-sm'>
                      <div>
                        <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                          Net received
                        </p>
                        <p className='mt-1 font-medium'>{formatMoney(Number(shift.netReceived))}</p>
                      </div>
                      <div>
                        <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                          Rate/hr
                        </p>
                        <p className='mt-1 font-medium'>{formatMoney(rate)}</p>
                      </div>
                    </div>
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