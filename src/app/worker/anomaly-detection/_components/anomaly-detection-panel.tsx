'use client';

import { useEffect, useMemo, useState } from 'react';
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
  explanation_urdu?: string;
  data?: Record<string, unknown>;
};

type AnomalyDetectResponse = {
  anomalies?: AnomalyResult[];
  flags?: AnomalyResult[];
  analyzedShifts?: number;
  analyzed_shifts?: number;
  summary?: string;
  summary_urdu?: string;
  openrouterResponse?: unknown;
  openrouter_response?: unknown;
};

const anomalyStoragePrefix = 'anomaly:last-result:';

function getAnomalyStorageKey(workerId: string): string {
  return `${anomalyStoragePrefix}${workerId}`;
}

function splitBilingualText(content: string): { english: string; urdu: string | null } {
  const text = content.trim();
  if (!text) {
    return { english: '', urdu: null };
  }

  const match = text.match(/(?:\r?\n){1,2}\s*(?:اردو|urdu)\s*:\s*/i);
  if (!match || typeof match.index !== 'number') {
    return { english: text, urdu: null };
  }

  const english = text.slice(0, match.index).trim();
  const urdu = text.slice(match.index + match[0].length).trim();
  return { english, urdu: urdu || null };
}

function formatPkr(value: unknown): string | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) {
    return null;
  }
  return `PKR ${num.toFixed(2)}`;
}

function formatPercent(value: unknown): string | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) {
    return null;
  }
  return `${num.toFixed(1)}%`;
}

function deterministicUrduForAnomaly(anomaly: AnomalyResult): string {
  const data = anomaly.data ?? {};

  switch (anomaly.type) {
    case 'deduction_spike': {
      const baseline = formatPercent(
        typeof data.baseline_median_rate === 'number'
          ? data.baseline_median_rate * 100
          : data.baseline_median_rate,
      );
      const recent = formatPercent(
        typeof data.recent_median_rate === 'number'
          ? data.recent_median_rate * 100
          : data.recent_median_rate,
      );
      const spike = formatPercent(data.spike_pct);
      if (baseline && recent && spike) {
        return `ہم نے دیکھا کہ آپ کی کٹوتی ${baseline} سے بڑھ کر ${recent} ہوگئی ہے۔ یہ تقریباً ${spike} اضافہ ہے اور ادائیگی متاثر ہوسکتی ہے۔`;
      }
      break;
    }
    case 'income_cliff': {
      const currentRate = formatPkr(data.current_week_median_effective_hourly);
      const rollingRate = formatPkr(data.rolling_median_effective_hourly);
      const drop = formatPercent(data.drop_pct);
      if (currentRate && rollingRate && drop) {
        return `آپ کی حالیہ فی گھنٹہ آمدنی ${rollingRate} سے کم ہو کر ${currentRate} رہ گئی ہے۔ یہ تقریباً ${drop} کمی ہے۔`;
      }
      break;
    }
    case 'income_drop_mom': {
      const current = formatPkr(data.current_month_net);
      const previous = formatPkr(data.previous_month_net);
      const drop = formatPercent(data.drop_pct);
      if (current && previous && drop) {
        return `پچھلے مہینے کے مقابلے میں آپ کی نیٹ آمدنی ${previous} سے کم ہو کر ${current} ہوگئی ہے۔ یہ تقریباً ${drop} کمی ہے۔`;
      }
      break;
    }
    case 'below_minimum_wage': {
      const effective = formatPkr(data.effective_hourly);
      const legal = formatPkr(data.legal_minimum_hourly);
      if (effective && legal) {
        return `آپ کی مؤثر فی گھنٹہ کمائی ${effective} ہے جو قانونی معیار ${legal} سے کم ہے۔`;
      }
      break;
    }
    case 'commission_creep': {
      const start = formatPercent(data.start_pct ?? data.baseline_median_rate);
      const end = formatPercent(data.end_pct ?? data.recent_median_rate);
      if (start && end) {
        return `آپ کی کمیشن کٹوتی ${start} سے بڑھ کر ${end} ہوگئی ہے، اس سے نیٹ ادائیگی کم ہوسکتی ہے۔`;
      }
      break;
    }
    default:
      break;
  }

  return 'ہم نے آپ کی ادائیگی میں ایک غیر معمولی مسئلہ دیکھا ہے۔ براہِ کرم متعلقہ شفٹس دوبارہ چیک کریں۔';
}

function deterministicSummaryUrdu(
  summaryEnglish: string | null,
  anomalyCount: number,
  analyzedShifts: number,
): string {
  const english = (summaryEnglish ?? '').trim().toLowerCase();
  if (!english || english.includes('no anomalies')) {
    return `ہم نے ${analyzedShifts} شفٹس چیک کیں اور کوئی غیر معمولی مسئلہ نہیں ملا۔`;
  }

  if (anomalyCount > 0) {
    return `ہم نے ${analyzedShifts} شفٹس کا جائزہ لیا اور ${anomalyCount} ادائیگی کے مسائل ملے۔ براہِ کرم ان شفٹس کو فوراً ریویو کریں۔`;
  }

  return `ہم نے ${analyzedShifts} شفٹس کا جائزہ لیا۔ ادائیگی کی تفصیل اوپر فراہم کی گئی ہے۔`;
}

function normalizeUrduPayload(
  payload: AnomalyDetectResponse | null,
): AnomalyDetectResponse | null {
  if (!payload) {
    return null;
  }

  const source = payload.anomalies ?? payload.flags ?? [];
  const normalizedAnomalies = source.map((anomaly) => {
    const parsed = splitBilingualText(anomaly.explanation ?? '');
    const urdu =
      anomaly.explanation_urdu ??
      parsed.urdu ??
      deterministicUrduForAnomaly({
        ...anomaly,
        explanation: parsed.english || anomaly.explanation,
      });
    const english = parsed.english || anomaly.explanation;

    return {
      ...anomaly,
      explanation: urdu ? `${english}\n\nاردو:\n${urdu}` : english,
      explanation_urdu: urdu,
    };
  });

  const parsedSummary = splitBilingualText(payload.summary ?? '');
  const summaryUrdu =
    payload.summary_urdu ??
    parsedSummary.urdu ??
    deterministicSummaryUrdu(
      parsedSummary.english || payload.summary || null,
      normalizedAnomalies.length,
      (payload.analyzedShifts ?? payload.analyzed_shifts ?? normalizedAnomalies.length) as number,
    );
  const summaryEnglish = parsedSummary.english || payload.summary;
  const summary = summaryEnglish
    ? summaryUrdu
      ? `${summaryEnglish}\n\nاردو:\n${summaryUrdu}`
      : summaryEnglish
    : payload.summary;

  return {
    ...payload,
    anomalies: normalizedAnomalies,
    summary,
    summary_urdu: summaryUrdu,
  };
}

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

function formatAnalyticsValue(value: unknown): string {
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000) {
      return formatMoney(value);
    }
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return 'N/A';
}

function formatAnalyticsLabel(key: string): string {
  return key.replace(/[_-]/g, ' ');
}

function BilingualText({ text, urdu, className }: { text: string; urdu?: string | null; className?: string }) {
  if (!text) return null;
  const parsed = splitBilingualText(text);
  const english = parsed.english || text;
  const urduText = (urdu ?? parsed.urdu ?? '').trim();

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div dir="ltr" className="whitespace-pre-wrap">{english}</div>
      {urduText && (
        <div 
          dir="rtl" 
          lang="ur" 
          className="font-[family-name:var(--font-urdu)] whitespace-pre-wrap text-right text-[1.15em]"
          style={{ 
            unicodeBidi: 'embed',
            lineHeight: 2
          }}
        >
          {urduText}
        </div>
      )}
    </div>
  );
}

export default function AnomalyDetectionPanel({ workerId }: { workerId: string }) {
  const { user } = useCurrentUser();
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [lastSuccessfulResult, setLastSuccessfulResult] =
    useState<AnomalyDetectResponse | null>(null);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const currentCityZone = user && 'cityZone' in user ? user.cityZone : null;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(getAnomalyStorageKey(workerId));
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as {
        submittedAt?: string;
        result?: AnomalyDetectResponse;
      };

      if (parsed?.result) {
        setLastSuccessfulResult(parsed.result);
      }

      if (typeof parsed?.submittedAt === 'string' && parsed.submittedAt) {
        setSubmittedAt(parsed.submittedAt);
      }
    } catch {
      // Ignore invalid local cache and continue with live fetches.
    } finally {
      setIsStorageHydrated(true);
    }
  }, [workerId]);

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
      const response = await client.api.anomaly.analyze.$post({
        json: { workerId },
      });

      if (!response.ok) {
        throw new Error('Anomaly detection failed');
      }

      return (await response.json()) as AnomalyDetectResponse;
    },
    onSuccess: (result) => {
      const now = new Date().toISOString();
      setLastSuccessfulResult(result);
      setSubmittedAt(now);

      try {
        window.localStorage.setItem(
          getAnomalyStorageKey(workerId),
          JSON.stringify({
            submittedAt: now,
            result,
          }),
        );
      } catch {
        // Ignore storage quota/private mode failures.
      }
    },
  });

  const effectiveResult = useMemo(
    () => normalizeUrduPayload(detectionMutation.data ?? lastSuccessfulResult),
    [detectionMutation.data, lastSuccessfulResult],
  );

  const anomalies = effectiveResult?.anomalies ?? effectiveResult?.flags ?? [];
  const openrouterResponse =
    effectiveResult?.openrouterResponse ??
    effectiveResult?.openrouter_response;
  const narrativeSummary = effectiveResult?.summary ?? null;
  const narrativeSummaryUrdu = effectiveResult?.summary_urdu ?? null;
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
  const analyzedShifts =
    effectiveResult?.analyzedShifts ??
    effectiveResult?.analyzed_shifts ??
    shifts.length;

  return (
    <div className='space-y-6'>
      <section className='relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-950/20 lg:p-8'>
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.18),_transparent_34%)]' />
        <div className='relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge className='border-0 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white'>
                Pay Protection
              </Badge>
              <Badge className='border-0 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100'>
                Last 90 Days Checked
              </Badge>
            </div>
            <div className='max-w-3xl space-y-3'>
              <h1 className='text-3xl font-black tracking-tight text-white lg:text-4xl'>
                Check My Pay
              </h1>
              <p className='max-w-2xl text-sm text-slate-300 sm:text-base'>
                We check your recent trips to see if the app unfairly reduced your pay or took hidden fees. 
                If we find anything wrong, we explain it simply so you know exactly what to do.
              </p>
            </div>
            <div className='flex flex-wrap gap-2 text-xs text-slate-300'>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                <Sparkles className='size-3.5' aria-hidden='true' />
                Clear math
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                <Waves className='size-3.5' aria-hidden='true' />
                Based on real trips
              </span>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[380px] lg:grid-cols-1 xl:grid-cols-3'>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Shifts
              </p>
              <p className='mt-1 text-2xl font-bold text-white'>{shifts.length}</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Avg rate
              </p>
              <p className='mt-1 text-2xl font-bold text-white'>{formatMoney(averageRate)}</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Deductions
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
                <CardTitle className='text-xl'>Start Checking</CardTitle>
                <CardDescription>
                  We will look at your last 90 days of work to find any pay issues.
                </CardDescription>
              </div>
              <Badge variant='outline' className='w-fit gap-1.5'>
                <Clock3 className='size-3.5' aria-hidden='true' />
                {submittedAt ? `Last run: ${new Intl.DateTimeFormat('en-PK', { timeStyle: 'short', dateStyle: 'medium' }).format(new Date(submittedAt))}` : 'Not run yet'}
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
                  Analyzed
                </p>
                <p className='mt-1 text-sm font-medium'>{analyzedShifts}</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
                <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                  Net
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
                {detectionMutation.isPending ? 'Checking your pay...' : 'Check My Pay Now'}
                <ArrowRight className='size-4' aria-hidden='true' />
              </Button>
              <p className='text-sm text-muted-foreground'>
                We only flag things when money looks missing.
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
                {lastSuccessfulResult && (
                  <p className='mt-1 text-xs opacity-80'>
                    Showing your last successful check below.
                  </p>
                )}
              </div>
            )}

            {!detectionMutation.isPending && !hasAnomalies && effectiveResult && (
              <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'>
                <div className='flex items-start gap-3'>
                  <CheckCircle2 className='mt-0.5 size-5 shrink-0' aria-hidden='true' />
                  <div>
                    <p className='font-semibold'>Everything looks good!</p>
                    <BilingualText
                      text={
                        narrativeSummary ??
                        'Your pay seems normal and we did not find any unfair deductions in your recent trips. Keep logging your shifts so we can protect your future earnings.'
                      }
                      urdu={narrativeSummaryUrdu}
                      className='mt-1 text-sm leading-relaxed'
                    />
                  </div>
                </div>
              </div>
            )}

            {!detectionMutation.isPending && hasAnomalies && (
              <div className='space-y-4'>
                {narrativeSummary && (
                  <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100'>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] opacity-80'>
                      Plain-language summary
                    </p>
                    <BilingualText
                      text={narrativeSummary}
                      urdu={narrativeSummaryUrdu}
                      className='mt-2 text-sm leading-relaxed'
                    />
                  </div>
                )}

                {sortedAnomalies.map((anomaly, index) => {
                  const Icon = severityIcon[anomaly.severity];
                  const analyticsEntries = Object.entries(anomaly.data ?? {}).filter(
                    ([, value]) =>
                      typeof value === 'number' ||
                      typeof value === 'string' ||
                      typeof value === 'boolean',
                  );

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
                            <BilingualText 
                              text={anomaly.explanation}
                              urdu={anomaly.explanation_urdu}
                              className='mt-3 text-sm leading-relaxed opacity-95' 
                            />

                            {analyticsEntries.length > 0 && (
                              <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                                {analyticsEntries.slice(0, 6).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className='rounded-xl border border-current/15 bg-background/60 px-3 py-2'
                                  >
                                    <p className='text-[10px] uppercase tracking-[0.14em] opacity-75'>
                                      {formatAnalyticsLabel(key)}
                                    </p>
                                    <p className='mt-1 text-xs font-semibold'>
                                      {formatAnalyticsValue(value)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
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

            {!detectionMutation.isPending && !effectiveResult && isStorageHydrated && shifts.length > 0 && (
              <div className='rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 text-sm text-muted-foreground'>
                Run "Check My Pay Now" once to cache your latest bilingual result on this device.
              </div>
            )}
          </CardContent>
        </Card>

        <div className='space-y-6'>
          <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
            <CardHeader>
              <CardTitle className='text-base'>What we look for</CardTitle>
              <CardDescription>
                We check for hidden fees and missing money in your pay.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <TrendingDown className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Sudden drops in your pay compared to your past trips.
                </p>
              </div>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <TrendingUp className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Hidden fees or extra deductions taken by the app without clear reason.
                </p>
              </div>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <Sparkles className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  We explain everything clearly so you know exactly what happened.
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
              <CardTitle className='text-base'>What to do next</CardTitle>
              <CardDescription>
                If we catch a pay issue, here is what you can do.
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