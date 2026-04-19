'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Loader2,
  Send,
  ShieldAlert,
  Siren,
  Sparkles,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { QUERY_KEYS } from '@/constants/query-keys';
import { type AiAction, streamAiChat } from '@/lib/ai-assistant';
import { cn } from '@/lib/utils';

type CommissionHeatmapResponse = {
  cells: Array<{
    weekStart: string;
    platformId: string;
    platformName: string;
    avgCommissionPct: number;
  }>;
};

type IncomeDistributionResponse = {
  buckets: Array<{
    platformId: string;
    platformName: string;
    bucketStart: number;
    bucketEnd: number;
    workerCount: number;
  }>;
};

type GrievanceBumpResponse = {
  points: Array<{
    weekStart: string;
    category: string;
    complaintCount: number;
    rank: number;
  }>;
};

type VulnerabilityTimelineResponse = {
  bars: Array<{
    monthStart: string;
    cityZone: string;
    flaggedWorkers: number;
  }>;
};

type PlatformRadarResponse = {
  platforms: Array<{
    platformId: string;
    platformName: string;
    medianEarnings: number;
    avgCommissionPct: number;
    grievanceCount: number;
    verificationRatePct: number;
    anomalyFlagCount: number;
  }>;
};

type CityZoneTreemapResponse = {
  nodes: Array<{
    cityZone: string;
    workerCount: number;
    medianNetEarned: number;
  }>;
};

type ComplaintStreamResponse = {
  layers: Array<{
    weekStart: string;
    category: string;
    count: number;
  }>;
};

type ExploitationScoreResponse = {
  ranking: Array<{
    platformId: string;
    platformName: string;
    exploitationScore: number;
    avgCommissionPct: number;
    incomeVolatility: number;
    complaintDensity: number;
    suddenDropFrequency: number;
    rank: number;
  }>;
};

type EarlyWarningResponse = {
  alerts: Array<{
    platformId: string;
    platformName: string;
    cityZone: string;
    dropPct: number;
    severity: 'critical' | 'warning' | 'normal';
  }>;
};

type ComplaintIntelligenceResponse = {
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  platformIssueHotspots: Array<{
    platformName: string;
    count: number;
  }>;
};

type DynamicRow = {
  period: string;
  [key: string]: number | string | null;
};

const currencyFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat('en-PK', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 1,
});

const SERIES_COLORS = [
  '#0ea5e9',
  '#14b8a6',
  '#f59e0b',
  '#e11d48',
  '#8b5cf6',
  '#22c55e',
  '#f97316',
  '#06b6d4',
];

const ADVOCATE_WINDOW_OPTIONS = [8, 12, 24, 52] as const;
const HISTOGRAM_BUCKET_OPTIONS = [2500, 5000, 10000] as const;
type AdvocateWindowWeeks = (typeof ADVOCATE_WINDOW_OPTIONS)[number];
type HistogramBucketSize = (typeof HISTOGRAM_BUCKET_OPTIONS)[number];

async function fetchAnalytics<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function formatWeekLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    day: 'numeric',
  });
}

function formatMonthLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    month: 'short',
    year: '2-digit',
  });
}

function formatMoney(value: number) {
  return currencyFormatter.format(value);
}

function formatCompact(value: number) {
  return compactNumberFormatter.format(value);
}

function formatPct(value: number) {
  return `${percentFormatter.format(value)}%`;
}

function normalizeSeries(values: number[]) {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return values.map(() => 100);
  }

  return values.map((value) => ((value - min) / (max - min)) * 100);
}

function getHeatColor(value: number, max: number) {
  if (max <= 0) {
    return 'hsla(201, 97%, 37%, 0.12)';
  }

  const ratio = Math.min(1, value / max);
  const hue = 130 - ratio * 120;
  const alpha = 0.16 + ratio * 0.74;

  return `hsla(${hue}, 88%, 44%, ${alpha})`;
}

function getZoneBlockColor(value: number, max: number) {
  if (max <= 0) {
    return 'hsla(194, 98%, 39%, 0.2)';
  }

  const ratio = Math.min(1, value / max);
  const alpha = 0.22 + ratio * 0.68;
  const hue = 200 - ratio * 92;

  return `hsla(${hue}, 88%, 42%, ${alpha})`;
}

function ChartCard({
  id,
  title,
  description,
  loading,
  error,
  empty = false,
  emptyMessage = 'No data in the selected window yet.',
  className,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  loading: boolean;
  error: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      className={cn(
        'border-border/60 bg-card/90 shadow-sm backdrop-blur transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-lg',
        className,
      )}
    >
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className='h-[320px] w-full rounded-3xl' />
        ) : error ? (
          <div className='flex h-[320px] items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 px-4 text-center text-sm text-destructive'>
            Unable to load this chart right now.
          </div>
        ) : empty ? (
          <div className='flex h-[320px] items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground'>
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function AdvocateAnalyticsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [windowWeeks, setWindowWeeks] = useState<AdvocateWindowWeeks>(24);
  const [histogramBucketSize, setHistogramBucketSize] =
    useState<HistogramBucketSize>(5000);
  const [briefPrompt, setBriefPrompt] = useState('');
  const [briefResponse, setBriefResponse] = useState('');
  const [briefActions, setBriefActions] = useState<AiAction[]>([]);
  const [isBriefLoading, setIsBriefLoading] = useState(false);

  const vulnerabilityWeeks = Math.max(windowWeeks, 24);
  const streamWeeks = Math.min(windowWeeks, 24);
  const earlyCurrentWeeks = windowWeeks >= 24 ? 2 : 1;
  const earlyBaselineWeeks = windowWeeks >= 24 ? 8 : 6;
  const complaintIntelligenceWeeks = Math.min(
    12,
    Math.max(4, Math.floor(windowWeeks / 2)),
  );

  const commissionHeatmapQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'commission-heatmap', windowWeeks],
    queryFn: () =>
      fetchAnalytics<CommissionHeatmapResponse>(
        `/api/analytics/advocate/commission-rate-heatmap?weeks=${windowWeeks}`,
      ),
    staleTime: 60_000,
  });

  const incomeDistributionQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'advocate',
      'income-distribution',
      windowWeeks,
      histogramBucketSize,
    ],
    queryFn: () =>
      fetchAnalytics<IncomeDistributionResponse>(
        `/api/analytics/advocate/income-distribution-histogram?weeks=${windowWeeks}&bucketSize=${histogramBucketSize}`,
      ),
    staleTime: 60_000,
  });

  const grievanceBumpQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'grievance-bump', windowWeeks],
    queryFn: () =>
      fetchAnalytics<GrievanceBumpResponse>(
        `/api/analytics/advocate/grievance-bump-chart?weeks=${windowWeeks}`,
      ),
    staleTime: 60_000,
  });

  const vulnerabilityTimelineQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'advocate',
      'vulnerability-timeline',
      vulnerabilityWeeks,
    ],
    queryFn: () =>
      fetchAnalytics<VulnerabilityTimelineResponse>(
        `/api/analytics/advocate/vulnerability-flag-timeline?weeks=${vulnerabilityWeeks}`,
      ),
    staleTime: 60_000,
  });

  const platformRadarQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'platform-radar', windowWeeks],
    queryFn: () =>
      fetchAnalytics<PlatformRadarResponse>(
        `/api/analytics/advocate/platform-comparison-radar?weeks=${windowWeeks}`,
      ),
    staleTime: 60_000,
  });

  const zoneTreemapQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'zone-treemap', windowWeeks],
    queryFn: () =>
      fetchAnalytics<CityZoneTreemapResponse>(
        `/api/analytics/advocate/city-zone-treemap?weeks=${windowWeeks}`,
      ),
    staleTime: 60_000,
  });

  const complaintStreamQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'complaint-stream', streamWeeks],
    queryFn: () =>
      fetchAnalytics<ComplaintStreamResponse>(
        `/api/analytics/advocate/complaint-cluster-stream?weeks=${streamWeeks}`,
      ),
    staleTime: 60_000,
  });

  const exploitationScoreQuery = useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'insights', 'exploitation-score', windowWeeks],
    queryFn: () =>
      fetchAnalytics<ExploitationScoreResponse>(
        `/api/analytics/insights/platform-exploitation-score?weeks=${windowWeeks}`,
      ),
    staleTime: 60_000,
  });

  const earlyWarningQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'insights',
      'early-warning',
      earlyCurrentWeeks,
      earlyBaselineWeeks,
    ],
    queryFn: () =>
      fetchAnalytics<EarlyWarningResponse>(
        `/api/analytics/insights/early-warning?currentWeeks=${earlyCurrentWeeks}&baselineWeeks=${earlyBaselineWeeks}&alertThresholdPct=15`,
      ),
    staleTime: 60_000,
  });

  const complaintIntelligenceQuery = useQuery({
    queryKey: [
      QUERY_KEYS.ANALYTICS,
      'insights',
      'complaint-intelligence',
      complaintIntelligenceWeeks,
    ],
    queryFn: () =>
      fetchAnalytics<ComplaintIntelligenceResponse>(
        `/api/analytics/insights/complaint-intelligence?weeks=${complaintIntelligenceWeeks}&topIssues=6&topKeywords=10`,
      ),
    staleTime: 60_000,
  });

  const allQueries = [
    commissionHeatmapQuery,
    incomeDistributionQuery,
    grievanceBumpQuery,
    vulnerabilityTimelineQuery,
    platformRadarQuery,
    zoneTreemapQuery,
    complaintStreamQuery,
    exploitationScoreQuery,
    earlyWarningQuery,
    complaintIntelligenceQuery,
  ];

  const hasAnyError = allQueries.some((query) => query.isError);

  const heatmapMatrix = useMemo(() => {
    const cells = commissionHeatmapQuery.data?.cells ?? [];
    const platforms = [...new Set(cells.map((cell) => cell.platformName))].sort();
    const weeks = [...new Set(cells.map((cell) => cell.weekStart))].sort();

    const valueByKey = new Map<string, number>();
    let maxCommissionPct = 0;

    for (const cell of cells) {
      valueByKey.set(`${cell.platformName}::${cell.weekStart}`, cell.avgCommissionPct);
      maxCommissionPct = Math.max(maxCommissionPct, cell.avgCommissionPct);
    }

    return {
      platforms,
      weeks,
      valueByKey,
      maxCommissionPct,
    };
  }, [commissionHeatmapQuery.data?.cells]);

  const incomeHistogram = useMemo(() => {
    const buckets = incomeDistributionQuery.data?.buckets ?? [];
    const platformMap = new Map<string, string>();
    const rowsMap = new Map<string, DynamicRow>();

    for (const bucket of buckets) {
      platformMap.set(bucket.platformId, bucket.platformName);

      const key = `${bucket.bucketStart}-${bucket.bucketEnd}`;
      const row =
        rowsMap.get(key) ??
        ({
          period: key,
          bucketStart: bucket.bucketStart,
          bucketEnd: bucket.bucketEnd,
        } as DynamicRow);

      row[bucket.platformId] = bucket.workerCount;
      rowsMap.set(key, row);
    }

    const rows = [...rowsMap.values()]
      .sort((a, b) => Number(a.bucketStart) - Number(b.bucketStart))
      .map((row) => ({
        ...row,
        label: `${formatCompact(Number(row.bucketStart))}-${formatCompact(Number(row.bucketEnd))}`,
      }) as DynamicRow);

    const platforms = [...platformMap.entries()].map(([id, name]) => ({ id, name }));

    for (const row of rows) {
      for (const platform of platforms) {
        if (typeof row[platform.id] === 'undefined') {
          row[platform.id] = 0;
        }
      }
    }

    return { rows, platforms };
  }, [incomeDistributionQuery.data?.buckets]);

  const incomeHistogramConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    incomeHistogram.platforms.forEach((platform, index) => {
      config[platform.id] = {
        label: platform.name,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

    return config;
  }, [incomeHistogram.platforms]);

  const grievanceBumpData = useMemo(() => {
    const points = grievanceBumpQuery.data?.points ?? [];
    const categoryCount = new Map<string, number>();

    for (const point of points) {
      categoryCount.set(
        point.category,
        (categoryCount.get(point.category) ?? 0) + point.complaintCount,
      );
    }

    const topCategories = [...categoryCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category]) => category);

    const rowsMap = new Map<string, DynamicRow>();

    for (const point of points) {
      if (!topCategories.includes(point.category)) {
        continue;
      }

      const row = rowsMap.get(point.weekStart) ?? { period: point.weekStart };
      row[point.category] = point.rank;
      rowsMap.set(point.weekStart, row);
    }

    const rows = [...rowsMap.values()].sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );

    for (const row of rows) {
      for (const category of topCategories) {
        if (typeof row[category] === 'undefined') {
          row[category] = null;
        }
      }
    }

    return {
      rows,
      topCategories,
      maxRank: Math.max(topCategories.length, 1),
    };
  }, [grievanceBumpQuery.data?.points]);

  const grievanceBumpConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    grievanceBumpData.topCategories.forEach((category, index) => {
      config[category] = {
        label: category,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

    return config;
  }, [grievanceBumpData.topCategories]);

  const vulnerabilitySeries = useMemo(() => {
    const bars = vulnerabilityTimelineQuery.data?.bars ?? [];
    const rowsMap = new Map<string, DynamicRow>();
    const cityZones = new Set<string>();

    for (const bar of bars) {
      cityZones.add(bar.cityZone);
      const row = rowsMap.get(bar.monthStart) ?? { period: bar.monthStart };
      row[bar.cityZone] = bar.flaggedWorkers;
      rowsMap.set(bar.monthStart, row);
    }

    const rows = [...rowsMap.values()].sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );

    const sortedCityZones = [...cityZones].sort();

    for (const row of rows) {
      for (const cityZone of sortedCityZones) {
        if (typeof row[cityZone] === 'undefined') {
          row[cityZone] = 0;
        }
      }
    }

    return {
      rows,
      cityZones: sortedCityZones,
    };
  }, [vulnerabilityTimelineQuery.data?.bars]);

  const vulnerabilityConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    vulnerabilitySeries.cityZones.forEach((cityZone, index) => {
      config[cityZone] = {
        label: cityZone,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

    return config;
  }, [vulnerabilitySeries.cityZones]);

  const radarSeries = useMemo(() => {
    const platforms = [...(platformRadarQuery.data?.platforms ?? [])]
      .sort((a, b) => b.grievanceCount - a.grievanceCount)
      .slice(0, 5);

    const metrics = [
      { key: 'medianEarnings', label: 'Median Earnings' },
      { key: 'avgCommissionPct', label: 'Avg Commission' },
      { key: 'grievanceCount', label: 'Grievances' },
      { key: 'verificationRatePct', label: 'Verification Rate' },
      { key: 'anomalyFlagCount', label: 'Anomaly Flags' },
    ] as const;

    const normalized = new Map<string, number[]>();

    for (const metric of metrics) {
      const values = platforms.map((platform) => platform[metric.key]);
      normalized.set(metric.key, normalizeSeries(values));
    }

    const radarRows = metrics.map((metric) => {
      const row: DynamicRow = {
        period: metric.label,
      };

      const normalizedValues = normalized.get(metric.key) ?? [];

      platforms.forEach((platform, index) => {
        row[platform.platformId] = normalizedValues[index] ?? 0;
      });

      return row;
    });

    return {
      platforms,
      radarRows,
    };
  }, [platformRadarQuery.data?.platforms]);

  const radarConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    radarSeries.platforms.forEach((platform, index) => {
      config[platform.platformId] = {
        label: platform.platformName,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

    return config;
  }, [radarSeries.platforms]);

  const zoneNodes = useMemo(() => {
    const nodes = [...(zoneTreemapQuery.data?.nodes ?? [])].sort(
      (a, b) => b.workerCount - a.workerCount,
    );

    const maxMedian = Math.max(
      ...nodes.map((node) => node.medianNetEarned),
      0,
    );

    return {
      nodes,
      maxMedian,
    };
  }, [zoneTreemapQuery.data?.nodes]);

  const complaintStreamSeries = useMemo(() => {
    const layers = complaintStreamQuery.data?.layers ?? [];
    const categoryCount = new Map<string, number>();

    for (const layer of layers) {
      categoryCount.set(layer.category, (categoryCount.get(layer.category) ?? 0) + layer.count);
    }

    const categories = [...categoryCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category]) => category);

    const rowsMap = new Map<string, DynamicRow>();

    for (const layer of layers) {
      if (!categories.includes(layer.category)) {
        continue;
      }

      const row = rowsMap.get(layer.weekStart) ?? { period: layer.weekStart };
      row[layer.category] = layer.count;
      rowsMap.set(layer.weekStart, row);
    }

    const rows = [...rowsMap.values()].sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );

    for (const row of rows) {
      for (const category of categories) {
        if (typeof row[category] === 'undefined') {
          row[category] = 0;
        }
      }
    }

    return {
      rows,
      categories,
    };
  }, [complaintStreamQuery.data?.layers]);

  const complaintStreamConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    complaintStreamSeries.categories.forEach((category, index) => {
      config[category] = {
        label: category,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

    return config;
  }, [complaintStreamSeries.categories]);

  const hasSparseSeries =
    (commissionHeatmapQuery.data?.cells.length ?? 0) < 20 ||
    incomeHistogram.rows.length < 4 ||
    grievanceBumpData.rows.length < 4;

  const exploitationTop = exploitationScoreQuery.data?.ranking.at(0);
  const earlyAlerts = earlyWarningQuery.data?.alerts ?? [];

  const summaryTiles = [
    {
      title: 'Most Exploitative Platform',
      value: exploitationTop?.platformName ?? 'N/A',
      detail: exploitationTop
        ? `Score ${formatPct(exploitationTop.exploitationScore)}`
        : 'Waiting for signal',
      icon: ShieldAlert,
    },
    {
      title: 'Early Warning Alerts',
      value: String(earlyAlerts.length),
      detail: 'Platform-zone combinations crossing threshold',
      icon: Siren,
    },
    {
      title: 'Top Complaint Keyword',
      value:
        complaintIntelligenceQuery.data?.topKeywords.at(0)?.keyword ??
        'No complaint keyword',
      detail: complaintIntelligenceQuery.data?.topKeywords.at(0)
        ? `${complaintIntelligenceQuery.data.topKeywords[0].count} mentions`
        : 'Waiting for signal',
      icon: Sparkles,
    },
  ];

  const runWeeklyBrief = async (message: string) => {
    const prompt = message.trim();
    if (!prompt) {
      return;
    }

    setIsBriefLoading(true);
    setBriefResponse('');
    setBriefActions([]);

    try {
      const result = await streamAiChat({
        payload: {
          mode: 'weekly_brief',
          message: prompt,
          threadSummary: `windowWeeks=${windowWeeks}; histogramBucketSize=${histogramBucketSize}`,
        },
        onToken: (_, fullText) => setBriefResponse(fullText),
      });

      setBriefResponse(result.cleanText || 'No response generated.');
      setBriefActions(result.structured?.actions ?? []);
    } catch (error) {
      setBriefResponse(
        error instanceof Error ? error.message : 'Unable to generate weekly brief right now.',
      );
    } finally {
      setIsBriefLoading(false);
    }
  };

  const exportBrief = () => {
    const content = briefResponse.trim();
    if (!content) {
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `weekly-brief-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBriefAction = (action: AiAction) => {
    if (action.type === 'EXPORT_WEEKLY_BRIEF') {
      exportBrief();
      return;
    }

    if (action.route) {
      router.push(action.route);
      return;
    }

    if (action.type === 'OPEN_ESCALATION_CANDIDATES') {
      router.push('/advocate/grievances?status=ESCALATED');
    }
  };

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_12%_8%,_rgba(245,158,11,0.12),_transparent_48%),radial-gradient(circle_at_88%_14%,_rgba(2,132,199,0.12),_transparent_40%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <section className='animate-in fade-in slide-in-from-top-4 duration-500'>
          <Card className='border-border/60 bg-card/95 shadow-md backdrop-blur'>
            <CardHeader className='gap-4 md:flex-row md:items-end md:justify-between'>
              <div className='space-y-2'>
                <Badge variant='outline'>Advocate Intelligence Deck</Badge>
                <CardTitle className='text-3xl font-semibold tracking-tight'>
                  Platform Justice Analytics
                </CardTitle>
                <CardDescription className='max-w-3xl text-sm text-muted-foreground'>
                  Dedicated analytics now lives here. Use this page for evidence
                  narratives, anomaly discovery, and courtroom-ready visuals while
                  keeping the main dashboard focused on workflow.
                </CardDescription>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Link
                  href='/advocate/dashboard'
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  Back To Dashboard
                </Link>
                <Link
                  href='/advocate/support'
                  className={cn(buttonVariants({ variant: 'default' }))}
                >
                  Review Support Tickets
                  <ArrowRight className='size-4' />
                </Link>
              </div>
            </CardHeader>
          </Card>
        </section>

        <section className='grid gap-4 md:grid-cols-3'>
          <Card className='md:col-span-3 border-border/60 bg-card/90'>
            <CardContent className='flex flex-wrap items-center gap-3 pt-6'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Analytics window
              </p>
              {ADVOCATE_WINDOW_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type='button'
                  size='sm'
                  variant={option === windowWeeks ? 'default' : 'outline'}
                  onClick={() => setWindowWeeks(option)}
                >
                  {option} weeks
                </Button>
              ))}
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:ml-3'>
                Histogram bucket
              </p>
              {HISTOGRAM_BUCKET_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type='button'
                  size='sm'
                  variant={option === histogramBucketSize ? 'default' : 'outline'}
                  onClick={() => setHistogramBucketSize(option)}
                >
                  PKR {option.toLocaleString()}
                </Button>
              ))}
              {hasSparseSeries ? (
                <Badge variant='secondary'>
                  Sparse history detected in this window; widen range for denser patterns.
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          <Card className='md:col-span-3 border-border/60 bg-card/90'>
            <CardHeader className='space-y-2'>
              <Badge variant='outline' className='w-fit'>
                Weekly Copilot
              </Badge>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Bot className='size-4' />
                Weekly Intelligence Brief
              </CardTitle>
              <CardDescription>
                Generate a concise, decision-ready memo and jump directly to impacted slices.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={isBriefLoading}
                  onClick={() => {
                    void runWeeklyBrief(
                      'Generate this week\'s intelligence brief: top deduction spikes, vulnerable cohorts, grievance clusters, and recommended actions.',
                    );
                  }}
                >
                  <Sparkles className='mr-1 size-3.5' />
                  Generate Brief
                </Button>
              </div>

              <div className='flex gap-2'>
                <Input
                  value={briefPrompt}
                  onChange={(event) => setBriefPrompt(event.target.value)}
                  placeholder='Ask for a specific memo focus (city, platform, cluster)...'
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const prompt = briefPrompt.trim();
                      if (!prompt || isBriefLoading) {
                        return;
                      }
                      setBriefPrompt('');
                      void runWeeklyBrief(prompt);
                    }
                  }}
                />
                <Button
                  type='button'
                  size='icon'
                  disabled={isBriefLoading || !briefPrompt.trim()}
                  onClick={() => {
                    const prompt = briefPrompt.trim();
                    if (!prompt) {
                      return;
                    }
                    setBriefPrompt('');
                    void runWeeklyBrief(prompt);
                  }}
                >
                  {isBriefLoading ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <Send className='size-4' />
                  )}
                </Button>
              </div>

              {briefResponse ? (
                <div className='space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3'>
                  <p className='whitespace-pre-wrap text-sm leading-relaxed'>{briefResponse}</p>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={isBriefLoading}
                      onClick={exportBrief}
                    >
                      Export Brief
                    </Button>
                    {briefActions.slice(0, 5).map((action) => (
                      <Button
                        key={action.id ?? action.label}
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isBriefLoading}
                        onClick={() => handleBriefAction(action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>
                  The generated brief includes action cards for navigation and export.
                </p>
              )}
            </CardContent>
          </Card>

          {summaryTiles.map((tile, index) => {
            const Icon = tile.icon;

            return (
              <Card
                key={tile.title}
                className={cn(
                  'animate-in fade-in slide-in-from-bottom-3 border-border/60 bg-card/90 duration-500',
                  index === 1 && 'delay-100',
                  index === 2 && 'delay-200',
                )}
              >
                <CardHeader className='pb-3'>
                  <CardDescription className='flex items-center gap-2 text-xs uppercase tracking-wide'>
                    <Icon className='size-4 text-primary' />
                    {tile.title}
                  </CardDescription>
                  <CardTitle className='text-2xl'>{tile.value}</CardTitle>
                </CardHeader>
                <CardContent className='pt-0 text-sm text-muted-foreground'>
                  {tile.detail}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {hasAnyError ? (
          <Card className='border-destructive/40 bg-destructive/5'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base text-destructive'>
                <AlertTriangle className='size-4' />
                Some analytics feeds failed
              </CardTitle>
              <CardDescription>
                One or more charts failed to load. Retry to refresh all datasets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant='destructive'
                onClick={() => {
                  void queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.ANALYTICS],
                  });
                }}
              >
                Retry Analytics Fetch
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className='grid gap-6 xl:grid-cols-2'>
          <ChartCard
            title='Commission Rate Heatmap'
            description='Rows are platforms, columns are weeks, color shows average commission intensity.'
            loading={commissionHeatmapQuery.isLoading}
            error={commissionHeatmapQuery.isError}
            empty={
              heatmapMatrix.platforms.length === 0 || heatmapMatrix.weeks.length === 0
            }
            emptyMessage='No platform-week commission samples available yet.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700'
          >
            <div className='overflow-x-auto rounded-3xl border border-border/60 bg-background/60 p-3'>
              <div
                className='grid min-w-[760px] gap-2 text-xs'
                style={{
                  gridTemplateColumns: `180px repeat(${Math.max(1, heatmapMatrix.weeks.length)}, minmax(54px, 1fr))`,
                }}
              >
                <div className='px-2 py-1 text-muted-foreground'>Platform / Week</div>
                {heatmapMatrix.weeks.map((week) => (
                  <div
                    key={week}
                    className='rounded-lg bg-muted/60 px-2 py-1 text-center text-[11px] text-muted-foreground'
                  >
                    {formatWeekLabel(week)}
                  </div>
                ))}

                {heatmapMatrix.platforms.map((platform) => (
                  <div key={platform} className='contents'>
                    <div
                      className='flex items-center rounded-lg bg-muted/50 px-2 py-2 text-xs font-medium'
                    >
                      {platform}
                    </div>
                    {heatmapMatrix.weeks.map((week) => {
                      const value =
                        heatmapMatrix.valueByKey.get(`${platform}::${week}`) ?? 0;

                      return (
                        <div
                          key={`${platform}-${week}`}
                          className='flex h-10 items-center justify-center rounded-lg font-medium text-foreground transition-transform duration-200 hover:scale-[1.05]'
                          style={{
                            backgroundColor: getHeatColor(
                              value,
                              heatmapMatrix.maxCommissionPct,
                            ),
                          }}
                        >
                          {formatPct(value)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title='Income Distribution Histogram'
            description='PKR buckets by platform, exposing bottom-heavy earnings distributions.'
            loading={incomeDistributionQuery.isLoading}
            error={incomeDistributionQuery.isError}
            empty={
              incomeHistogram.rows.length === 0 ||
              incomeHistogram.platforms.length === 0
            }
            emptyMessage='Income distribution buckets will appear once workers have enough historical earnings.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100'
          >
            <ChartContainer className='h-[320px] w-full' config={incomeHistogramConfig}>
              <BarChart data={incomeHistogram.rows} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis dataKey='label' interval='preserveStartEnd' minTickGap={18} />
                <YAxis tickFormatter={(value) => formatCompact(Number(value))} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {incomeHistogram.platforms.map((platform, index) => (
                  <Bar
                    key={platform.id}
                    dataKey={platform.id}
                    name={platform.name}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    radius={[6, 6, 0, 0]}
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
                <Brush dataKey='label' height={22} travellerWidth={10} />
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Grievance Bump Chart'
            description='Weekly category rankings. Lower rank number means higher urgency.'
            loading={grievanceBumpQuery.isLoading}
            error={grievanceBumpQuery.isError}
            empty={
              grievanceBumpData.rows.length === 0 ||
              grievanceBumpData.topCategories.length === 0
            }
            emptyMessage='Grievance ranking requires category activity across multiple weeks.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200'
          >
            <ChartContainer className='h-[320px] w-full' config={grievanceBumpConfig}>
              <LineChart data={grievanceBumpData.rows} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis dataKey='period' tickFormatter={formatWeekLabel} minTickGap={20} />
                <YAxis reversed domain={[grievanceBumpData.maxRank + 0.5, 1]} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <ReferenceLine y={1} stroke='#ef4444' strokeOpacity={0.4} strokeDasharray='4 5' />
                {grievanceBumpData.topCategories.map((category, index) => (
                  <Line
                    key={category}
                    dataKey={category}
                    name={category}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2.3}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
                <Brush
                  dataKey='period'
                  height={22}
                  travellerWidth={10}
                  tickFormatter={formatWeekLabel}
                />
              </LineChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Vulnerability Flag Timeline'
            description='Monthly flagged worker counts segmented by city zone.'
            loading={vulnerabilityTimelineQuery.isLoading}
            error={vulnerabilityTimelineQuery.isError}
            empty={
              vulnerabilitySeries.rows.length === 0 ||
              vulnerabilitySeries.cityZones.length === 0
            }
            emptyMessage='Vulnerability timeline populates after monthly income drops are detected.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300'
          >
            <ChartContainer className='h-[320px] w-full' config={vulnerabilityConfig}>
              <BarChart data={vulnerabilitySeries.rows} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis dataKey='period' tickFormatter={formatMonthLabel} />
                <YAxis tickFormatter={(value) => String(value)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {vulnerabilitySeries.cityZones.map((cityZone, index) => (
                  <Bar
                    key={cityZone}
                    dataKey={cityZone}
                    name={cityZone}
                    stackId='flags'
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
                <Brush
                  dataKey='period'
                  height={22}
                  travellerWidth={10}
                  tickFormatter={formatMonthLabel}
                />
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='Platform Comparison Radar'
            description='Normalized cross-metric comparison for top grievance-heavy platforms.'
            loading={platformRadarQuery.isLoading}
            error={platformRadarQuery.isError}
            empty={radarSeries.platforms.length === 0}
            emptyMessage='Radar comparison needs platform activity in the selected period.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400'
          >
            <ChartContainer className='h-[320px] w-full' config={radarConfig}>
              <RadarChart data={radarSeries.radarRows}>
                <PolarGrid />
                <PolarAngleAxis dataKey='period' />
                <PolarRadiusAxis domain={[0, 100]} tickFormatter={(value) => `${value}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {radarSeries.platforms.map((platform, index) => (
                  <Radar
                    key={platform.platformId}
                    dataKey={platform.platformId}
                    name={platform.platformName}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    fillOpacity={0.18}
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
              </RadarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard
            title='City Zone Treemap View'
            description='Block size approximates worker count, color intensity reflects median net earned.'
            loading={zoneTreemapQuery.isLoading}
            error={zoneTreemapQuery.isError}
            empty={zoneNodes.nodes.length === 0}
            emptyMessage='Zone blocks appear when zone-level shift data is available.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500'
          >
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {zoneNodes.nodes.map((node) => (
                <article
                  key={node.cityZone}
                  className='rounded-3xl border border-white/20 p-4 text-foreground shadow-sm transition-transform duration-300 hover:-translate-y-0.5'
                  style={{
                    backgroundColor: getZoneBlockColor(
                      node.medianNetEarned,
                      zoneNodes.maxMedian,
                    ),
                    minHeight: `${96 + Math.min(node.workerCount, 90)}px`,
                  }}
                >
                  <p className='text-sm font-semibold'>{node.cityZone}</p>
                  <p className='mt-2 text-xs'>Workers: {node.workerCount.toLocaleString()}</p>
                  <p className='text-xs'>Median Net: {formatMoney(node.medianNetEarned)}</p>
                </article>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title='Complaint Cluster Stream'
            description='Category stream over 8 weeks to reveal collective complaint waves.'
            loading={complaintStreamQuery.isLoading}
            error={complaintStreamQuery.isError}
            empty={
              complaintStreamSeries.rows.length === 0 ||
              complaintStreamSeries.categories.length === 0
            }
            emptyMessage='Complaint stream needs recurring grievance categories over time.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600 xl:col-span-2'
          >
            <ChartContainer className='h-[340px] w-full' config={complaintStreamConfig}>
              <AreaChart data={complaintStreamSeries.rows} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='4 4' />
                <XAxis dataKey='period' tickFormatter={formatWeekLabel} />
                <YAxis tickFormatter={(value) => String(value)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {complaintStreamSeries.categories.map((category, index) => (
                  <Area
                    key={category}
                    dataKey={category}
                    name={category}
                    stackId='complaints'
                    type='monotone'
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    fillOpacity={0.24}
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
                <Brush
                  dataKey='period'
                  height={22}
                  travellerWidth={10}
                  tickFormatter={formatWeekLabel}
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>
        </section>

        <section className='grid gap-6 xl:grid-cols-[1.2fr_0.8fr]'>
          <ChartCard
            id='exploitation-score'
            title='Platform Exploitation Score'
            description='Weighted score combining commission, volatility, complaint density, and sudden drops.'
            loading={exploitationScoreQuery.isLoading}
            error={exploitationScoreQuery.isError}
            empty={(exploitationScoreQuery.data?.ranking.length ?? 0) === 0}
            emptyMessage='Exploitation ranking appears after enough multi-platform history is available.'
            className='animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700'
          >
            <ChartContainer
              className='h-[320px] w-full'
              config={{ exploitationScore: { label: 'Exploitation Score', color: '#ef4444' } }}
            >
              <BarChart
                data={[...(exploitationScoreQuery.data?.ranking ?? [])]
                  .slice(0, 7)
                  .reverse()}
                layout='vertical'
                margin={{ left: 24, right: 24 }}
              >
                <CartesianGrid strokeDasharray='4 4' horizontal={false} />
                <XAxis type='number' tickFormatter={(value) => formatPct(Number(value))} />
                <YAxis
                  type='category'
                  dataKey='platformName'
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey='exploitationScore'
                  radius={[0, 10, 10, 0]}
                  fill='var(--color-exploitationScore)'
                  isAnimationActive
                  animationDuration={900}
                >
                  <LabelList
                    dataKey='exploitationScore'
                    position='right'
                    formatter={(value) => formatPct(Number(value ?? 0))}
                    className='fill-foreground text-[11px]'
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <Card
            id='early-warning'
            className='animate-in fade-in slide-in-from-bottom-4 border-border/60 bg-card/90 duration-700 delay-800'
          >
            <CardHeader>
              <CardTitle className='text-base'>Early Warnings And Issue Signals</CardTitle>
              <CardDescription>
                Real-time signals from the early warning and complaint intelligence APIs.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-2xl border border-border/60 bg-background/60 p-3'>
                <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Active alerts
                </p>
                <div className='space-y-2'>
                  {earlyAlerts.slice(0, 5).map((alert) => (
                    <div
                      key={`${alert.platformId}-${alert.cityZone}`}
                      className='rounded-xl border border-border/70 px-3 py-2'
                    >
                      <p className='text-sm font-medium'>
                        {alert.platformName} · {alert.cityZone}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        Drop: {formatPct(alert.dropPct)}
                      </p>
                    </div>
                  ))}
                  {earlyAlerts.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No active alerts in this window.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className='rounded-2xl border border-border/60 bg-background/60 p-3'>
                <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Top complaint keywords
                </p>
                <div className='flex flex-wrap gap-2'>
                  {(complaintIntelligenceQuery.data?.topKeywords ?? [])
                    .slice(0, 10)
                    .map((keyword) => (
                      <Badge key={keyword.keyword} variant='outline'>
                        {keyword.keyword} ({keyword.count})
                      </Badge>
                    ))}
                </div>
              </div>

              <div className='rounded-2xl border border-border/60 bg-background/60 p-3'>
                <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Top categories
                </p>
                <div className='space-y-1.5 text-sm'>
                  {(complaintIntelligenceQuery.data?.topCategories ?? [])
                    .slice(0, 5)
                    .map((category) => (
                      <div
                        key={category.category}
                        className='flex items-center justify-between'
                      >
                        <span>{category.category}</span>
                        <span className='font-mono text-muted-foreground'>
                          {category.count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
