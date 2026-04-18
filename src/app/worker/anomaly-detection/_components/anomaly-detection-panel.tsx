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
  TriangleAlert,
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
  const hasAnomalies = sortedAnomalies.length > 0;
  const analyzedShifts =
    effectiveResult?.analyzedShifts ??
    effectiveResult?.analyzed_shifts ??
    shifts.length;

  return (
    <div className='mx-auto w-full max-w-5xl space-y-5'>
      <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
        <CardHeader className='space-y-3'>
          <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle className='text-xl'>Start Checking</CardTitle>
              <CardDescription>
                We scan your last 90 days of shifts to detect unusual pay deductions.
              </CardDescription>
            </div>
            <Badge variant='outline' className='w-fit gap-1.5'>
              <Clock3 className='size-3.5' aria-hidden='true' />
              {submittedAt
                ? `Last run: ${new Intl.DateTimeFormat('en-PK', {
                    timeStyle: 'short',
                    dateStyle: 'medium',
                  }).format(new Date(submittedAt))}`
                : 'Not run yet'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className='space-y-5'>
          <div className='grid gap-3 sm:grid-cols-3'>
            <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
              <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>Window</p>
              <p className='mt-1 text-sm font-medium'>Last 90 days</p>
            </div>
            <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
              <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>Analyzed</p>
              <p className='mt-1 text-sm font-medium'>{analyzedShifts}</p>
            </div>
            <div className='rounded-2xl border border-border/60 bg-muted/30 px-4 py-3'>
              <p className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>Net</p>
              <p className='mt-1 text-sm font-medium'>{formatMoney(totalNet)}</p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <Button
              onClick={() => detectionMutation.mutate()}
              disabled={detectionMutation.isPending || shiftsLoading || shifts.length === 0}
              className='gap-2'
            >
              {detectionMutation.isPending ? 'Checking...' : 'Check My Pay Now'}
              <ArrowRight className='size-4' aria-hidden='true' />
            </Button>
            <p className='text-sm text-muted-foreground'>
              We only flag results when something looks off.
            </p>
          </div>

          {detectionMutation.isPending && (
            <div className='space-y-2'>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className='h-20 w-full rounded-2xl' />
              ))}
            </div>
          )}

          {!detectionMutation.isPending && detectionMutation.isError && (
            <div className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'>
              <p className='text-sm font-medium'>Unable to run anomaly detection right now.</p>
              {lastSuccessfulResult && (
                <p className='mt-1 text-xs opacity-80'>Showing your last successful check.</p>
              )}
            </div>
          )}

          {!detectionMutation.isPending && !hasAnomalies && effectiveResult && (
            <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'>
              <div className='flex items-start gap-3'>
                <CheckCircle2 className='mt-0.5 size-5 shrink-0' aria-hidden='true' />
                <div>
                  <p className='font-semibold'>Everything looks good</p>
                  <BilingualText
                    text={
                      narrativeSummary ??
                      'Your pay seems normal and we did not find unfair deductions in recent trips.'
                    }
                    urdu={narrativeSummaryUrdu}
                    className='mt-1 text-sm leading-relaxed'
                  />
                </div>
              </div>
            </div>
          )}

          {!detectionMutation.isPending && hasAnomalies && (
            <div className='space-y-3'>
              {narrativeSummary && (
                <div className='rounded-2xl border border-border/60 bg-muted/20 px-4 py-4'>
                  <p className='text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
                    Summary
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
                    <div className='flex items-start gap-3'>
                      <div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/70'>
                        <Icon className='size-4.5' aria-hidden='true' />
                      </div>

                      <div className='flex-1 space-y-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h3 className='text-sm font-semibold capitalize'>
                            {anomaly.type.replace(/[_-]/g, ' ')}
                          </h3>
                          <Badge
                            variant='outline'
                            className='border-current/20 bg-background/70 text-[10px] uppercase tracking-[0.16em]'
                          >
                            {anomaly.severity}
                          </Badge>
                        </div>

                        <BilingualText
                          text={anomaly.explanation}
                          urdu={anomaly.explanation_urdu}
                          className='text-sm leading-relaxed opacity-95'
                        />

                        {analyticsEntries.length > 0 && (
                          <div className='grid gap-2 sm:grid-cols-2'>
                            {analyticsEntries.slice(0, 4).map(([key, value]) => (
                              <div
                                key={key}
                                className='rounded-xl border border-current/15 bg-background/60 px-3 py-2'
                              >
                                <p className='text-[10px] uppercase tracking-[0.12em] opacity-70'>
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
                  </div>
                );
              })}
            </div>
          )}

          {!detectionMutation.isPending && !effectiveResult && isStorageHydrated && shifts.length > 0 && (
            <div className='rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 text-sm text-muted-foreground'>
              Run "Check My Pay Now" once to generate your first anomaly summary.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
        <CardHeader>
          <CardTitle className='text-base'>Recent shifts used for analysis</CardTitle>
          <CardDescription>
            Latest records included in anomaly detection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shiftsLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className='h-12 w-full rounded-xl' />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground'>
              No shifts available yet. Log earnings first so anomaly detection can run.
            </div>
          ) : (
            <div className='space-y-2'>
              {shifts
                .slice(-6)
                .reverse()
                .map((shift) => {
                  const rate = computeRate(shift);

                  return (
                    <div
                      key={shift.id}
                      className='flex flex-col gap-2 rounded-xl border border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between'
                    >
                      <div>
                        <p className='text-sm font-medium'>{shift.platform.name}</p>
                        <p className='text-xs text-muted-foreground'>{formatDate(shift.shiftDate)}</p>
                      </div>

                      <div className='flex items-center gap-2 text-xs sm:gap-3 sm:text-sm'>
                        <Badge variant='outline'>{shift.verificationStatus}</Badge>
                        <span className='text-muted-foreground'>Net</span>
                        <span className='font-medium'>{formatMoney(Number(shift.netReceived))}</span>
                        <span className='text-muted-foreground'>Rate</span>
                        <span className='font-medium'>{formatMoney(rate)}</span>
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