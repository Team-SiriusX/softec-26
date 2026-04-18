"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

interface ChartPoint {
  name: string;
  value: number;
  verifiedEarnings: number;
  certificatesChecked: number;
  grievancesAutoFlagged: number;
  advocatesActive: number;
}

interface TooltipPayloadItem {
  payload: ChartPoint;
  value?: number | string;
}

interface StatsTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const chartData: ChartPoint[] = [
  {
    name: "Jan",
    value: 46,
    verifiedEarnings: 18240,
    certificatesChecked: 10900,
    grievancesAutoFlagged: 112,
    advocatesActive: 2810,
  },
  {
    name: "Feb",
    value: 51,
    verifiedEarnings: 19860,
    certificatesChecked: 11630,
    grievancesAutoFlagged: 124,
    advocatesActive: 2895,
  },
  {
    name: "Mar",
    value: 58,
    verifiedEarnings: 21420,
    certificatesChecked: 12540,
    grievancesAutoFlagged: 131,
    advocatesActive: 3010,
  },
  {
    name: "Apr",
    value: 66,
    verifiedEarnings: 23670,
    certificatesChecked: 13980,
    grievancesAutoFlagged: 145,
    advocatesActive: 3158,
  },
  {
    name: "May",
    value: 73,
    verifiedEarnings: 25890,
    certificatesChecked: 15210,
    grievancesAutoFlagged: 151,
    advocatesActive: 3264,
  },
  {
    name: "Jun",
    value: 81,
    verifiedEarnings: 27980,
    certificatesChecked: 16320,
    grievancesAutoFlagged: 166,
    advocatesActive: 3395,
  },
  {
    name: "Jul",
    value: 90,
    verifiedEarnings: 30540,
    certificatesChecked: 17900,
    grievancesAutoFlagged: 173,
    advocatesActive: 3528,
  },
];

const statCards = [
  {
    value: "84,000+",
    title: "Earnings records verified",
    railLeft: "WAGE PROOF",
    railRight: "LIVE",
    subline: "For workers, advocates, and institutions",
  },
  {
    value: "98.7%",
    title: "Certificate integrity score",
    railLeft: "CREDENTIAL",
    railRight: "TRUSTED",
    subline: "Cross-service verification confidence",
  },
  {
    value: "3,500+",
    title: "Active advocates",
    railLeft: "ADVOCATE",
    railRight: "NETWORK",
    subline: "Case-ready support capacity",
  },
  {
    value: "1.8s",
    title: "Median verification response",
    railLeft: "REAL TIME",
    railRight: "PIPELINE",
    subline: "Fast signal delivery under load",
  },
];

function StatsTooltip({ active, payload, label }: StatsTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="w-72 rounded-2xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.16em]">
        {label} FairGig Snapshot
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">
        Trust Signal Index: {point.value}/100
      </p>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p>
          Verified earnings records: {point.verifiedEarnings.toLocaleString()}
        </p>
        <p>
          Certificates checked: {point.certificatesChecked.toLocaleString()}
        </p>
        <p>
          Grievances auto-flagged: {point.grievancesAutoFlagged.toLocaleString()}
        </p>
        <p>Active advocates: {point.advocatesActive.toLocaleString()}</p>
      </div>
    </div>
  );
}

export default function FeaturedSectionStats() {
  return (
    <section className="mx-auto w-full max-w-6xl py-24 text-left">
      <div className="px-4 md:px-6">
        <div className="relative max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-card p-6 md:p-8">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground md:text-xs">
            FAIRGIG INTELLIGENCE LAYER
          </p>
          <h3 className="text-3xl font-black tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Verifying gig-work dignity with live, audit-ready intelligence.
          </h3>
          <p className="mt-4 max-w-4xl text-base font-medium text-muted-foreground md:text-xl">
            FairGig combines earnings proof, certificate validation, and grievance
            anomaly detection into a single trust infrastructure for workers,
            advocates, and institutions.
          </p>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/12 md:text-xs">
            <span>WAGE VERIFICATION</span>
            <span>CERTIFICATE TRUST</span>
            <span>GRIEVANCE RISK</span>
            <span>ADVOCATE FLOW</span>
            <span>REAL-TIME DECISIONS</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              className="relative rounded-2xl border border-border/70 bg-card p-5"
              key={card.title}
            >
              <div className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <span>{card.railLeft}</span>
                <span>{card.railRight}</span>
              </div>

              <p className="text-4xl font-black leading-none tracking-tight text-foreground md:text-5xl">
                {card.value}
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {card.title}
              </p>

              <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {card.subline}
              </p>

              <div className="pointer-events-none absolute bottom-2 right-3 text-[9px] font-black uppercase tracking-[0.18em] text-foreground/12">
                FAIRGIG
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 h-56 w-full px-4 md:px-6">
        <div className="h-full w-full rounded-2xl border border-border/70 bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Trust Signal Trend
          </div>

          <ResponsiveContainer width="100%" height="88%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fairgig-signal-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>

              <Tooltip
                cursor={{ stroke: "#94a3b8", strokeDasharray: "3 4" }}
                content={<StatsTooltip />}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#fairgig-signal-gradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
