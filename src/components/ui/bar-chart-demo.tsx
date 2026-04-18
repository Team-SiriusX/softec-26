"use client";

import { BarChart, Bar, BarXAxis, Grid, ChartTooltip } from "@/components/ui/bar-chart";

const fairGigVisualizerData = [
  {
    frame: "Q1",
    confidence: 62,
    momentum: 55,
    verifiedEarningsRecords: 18400,
    certificatesChecked: 9200,
    grievancesAutoFlagged: 112,
  },
  {
    frame: "Q2",
    confidence: 67,
    momentum: 59,
    verifiedEarningsRecords: 20150,
    certificatesChecked: 10340,
    grievancesAutoFlagged: 129,
  },
  {
    frame: "Q3",
    confidence: 63,
    momentum: 71,
    verifiedEarningsRecords: 22460,
    certificatesChecked: 11890,
    grievancesAutoFlagged: 141,
  },
  {
    frame: "Q4",
    confidence: 74,
    momentum: 66,
    verifiedEarningsRecords: 23810,
    certificatesChecked: 12600,
    grievancesAutoFlagged: 136,
  },
  {
    frame: "Q5",
    confidence: 69,
    momentum: 78,
    verifiedEarningsRecords: 25700,
    certificatesChecked: 13920,
    grievancesAutoFlagged: 152,
  },
  {
    frame: "Q6",
    confidence: 81,
    momentum: 73,
    verifiedEarningsRecords: 27140,
    certificatesChecked: 14830,
    grievancesAutoFlagged: 147,
  },
  {
    frame: "Q7",
    confidence: 76,
    momentum: 84,
    verifiedEarningsRecords: 29480,
    certificatesChecked: 16210,
    grievancesAutoFlagged: 168,
  },
  {
    frame: "Q8",
    confidence: 88,
    momentum: 80,
    verifiedEarningsRecords: 31220,
    certificatesChecked: 17160,
    grievancesAutoFlagged: 159,
  },
];

const topStickers = [
  {
    text: "Regulatory Grade",
    rotate: "-rotate-2",
  },
  {
    text: "Live Trust Layer",
    rotate: "rotate-1",
  },
  {
    text: "Verified Earnings Trace",
    rotate: "-rotate-1",
  },
  {
    text: "Dispute-Safe Signals",
    rotate: "rotate-2",
  },
];

const bottomStickers = [
  {
    text: "Advocate Intelligence",
    rotate: "-rotate-2",
  },
  {
    text: "Capital-Ready UX",
    rotate: "rotate-1",
  },
  {
    text: "Risk-Calibrated",
    rotate: "-rotate-1",
  },
  {
    text: "Forensic Clarity",
    rotate: "rotate-2",
  },
];

export default function BarChartDemo() {
  return (
    <section className="relative w-full bg-background py-20">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="mb-10 text-center">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.28em]">
            FairGig Signature Visual
          </p>
          <h3 className="text-foreground mt-3 text-4xl font-black tracking-tight md:text-5xl">
            Institutional Trust Visualizer
          </h3>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm md:text-base">
            Premium fintech-style artifact with controlled motion and refined chart dynamics,
            designed to elevate the FairGig brand presence.
          </p>
        </div>

        <div className="relative rounded-[2rem] border border-border/70 bg-card p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)] md:p-7">
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-foreground/5" />

          <div className="mb-5 flex flex-wrap items-center justify-center gap-3 md:mb-6 md:gap-4">
            {topStickers.map((note) => (
              <div
                className={`rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-black text-2xl text-slate-800 leading-none tracking-tight shadow-[0_10px_22px_-14px_rgba(15,23,42,0.45)] md:px-5 md:py-2.5 md:text-[2rem] ${note.rotate}`}
                key={note.text}
              >
                {note.text}
              </div>
            ))}
          </div>

          <BarChart data={fairGigVisualizerData} xDataKey="frame" className="w-full">
            <defs>
              <linearGradient id="artifact-confidence" x1="0%" x2="0%" y1="100%" y2="0%">
                <stop offset="0%" stopColor="#1e293b">
                  <animate
                    attributeName="stop-color"
                    dur="8s"
                    repeatCount="indefinite"
                    values="#1e293b;#0f172a;#1e3a8a;#1e293b"
                  />
                </stop>
                <stop offset="100%" stopColor="#2563eb">
                  <animate
                    attributeName="stop-color"
                    dur="8s"
                    repeatCount="indefinite"
                    values="#2563eb;#334155;#1d4ed8;#2563eb"
                  />
                </stop>
              </linearGradient>
              <linearGradient id="artifact-momentum" x1="0%" x2="0%" y1="100%" y2="0%">
                <stop offset="0%" stopColor="#0f766e">
                  <animate
                    attributeName="stop-color"
                    dur="9s"
                    repeatCount="indefinite"
                    values="#0f766e;#0b3b66;#0d9488;#0f766e"
                  />
                </stop>
                <stop offset="100%" stopColor="#0891b2">
                  <animate
                    attributeName="stop-color"
                    dur="9s"
                    repeatCount="indefinite"
                    values="#0891b2;#2563eb;#0ea5a4;#0891b2"
                  />
                </stop>
              </linearGradient>
            </defs>

            <Grid horizontal stroke="rgba(100, 116, 139, 0.22)" strokeDasharray="3,7" />
            <Bar
              dataKey="confidence"
              fill="url(#artifact-confidence)"
              lineCap="round"
              animationType="grow"
            />
            <Bar
              dataKey="momentum"
              fill="url(#artifact-momentum)"
              lineCap="round"
              animationType="grow"
            />
            <BarXAxis />
            <ChartTooltip
              rows={(point) => [
                {
                  color: "#1d4ed8",
                  label: "Trust Confidence",
                  value: `${Number(point.confidence ?? 0)} / 100`,
                },
                {
                  color: "#0d9488",
                  label: "Verification Momentum",
                  value: `${Number(point.momentum ?? 0)} / 100`,
                },
                {
                  color: "#1e293b",
                  label: "Verified Earnings Records",
                  value: Number(point.verifiedEarningsRecords ?? 0).toLocaleString(),
                },
                {
                  color: "#0891b2",
                  label: "Certificates Checked",
                  value: Number(point.certificatesChecked ?? 0).toLocaleString(),
                },
                {
                  color: "#b45309",
                  label: "Grievances Auto-Flagged",
                  value: Number(point.grievancesAutoFlagged ?? 0).toLocaleString(),
                },
              ]}
            >
              <p className="text-chart-tooltip-muted text-xs">
                FairGig signal stack: wage-proof verification, advocate-ready
                certificates, and early grievance risk detection.
              </p>
            </ChartTooltip>
          </BarChart>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:mt-6 md:gap-4">
            {bottomStickers.map((note) => (
              <div
                className={`rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-black text-2xl text-slate-800 leading-none tracking-tight shadow-[0_10px_22px_-14px_rgba(15,23,42,0.45)] md:px-5 md:py-2.5 md:text-[2rem] ${note.rotate}`}
                key={note.text}
              >
                {note.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
