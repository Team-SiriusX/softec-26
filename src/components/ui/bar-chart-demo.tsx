"use client";

import { motion } from "motion/react";
import { BarChart, Bar, BarXAxis, Grid, ChartTooltip } from "@/components/ui/bar-chart";

const fairGigVisualizerData = [
  { frame: "Q1", confidence: 62, momentum: 55 },
  { frame: "Q2", confidence: 67, momentum: 59 },
  { frame: "Q3", confidence: 63, momentum: 71 },
  { frame: "Q4", confidence: 74, momentum: 66 },
  { frame: "Q5", confidence: 69, momentum: 78 },
  { frame: "Q6", confidence: 81, momentum: 73 },
  { frame: "Q7", confidence: 76, momentum: 84 },
  { frame: "Q8", confidence: 88, momentum: 80 },
];

const swingingNotes = [
  {
    text: "Regulatory Grade",
    className: "-left-2 top-6 md:-left-6",
    duration: 7.8,
    delay: 0,
    x: 12,
    y: -10,
    r: 2,
  },
  {
    text: "Live Trust Layer",
    className: "right-2 top-10 md:-right-5",
    duration: 8.5,
    delay: 0.3,
    x: -11,
    y: 12,
    r: -2,
  },
  {
    text: "Verified Earnings Trace",
    className: "left-10 -top-2 md:left-20",
    duration: 7.2,
    delay: 0.6,
    x: 8,
    y: 10,
    r: 1.5,
  },
  {
    text: "Dispute-Safe Signals",
    className: "bottom-5 -left-1 md:-left-8",
    duration: 8.9,
    delay: 0.4,
    x: 10,
    y: -8,
    r: 2,
  },
  {
    text: "Advocate Intelligence",
    className: "-bottom-1 left-[32%]",
    duration: 7.4,
    delay: 0.2,
    x: -10,
    y: 9,
    r: -1.8,
  },
  {
    text: "Capital-Ready UX",
    className: "bottom-6 right-6 md:right-0",
    duration: 8.1,
    delay: 0.7,
    x: 12,
    y: 7,
    r: 2.2,
  },
  {
    text: "Risk-Calibrated",
    className: "right-[18%] -top-3",
    duration: 7.6,
    delay: 0.5,
    x: -8,
    y: 11,
    r: -1.6,
  },
  {
    text: "Forensic Clarity",
    className: "left-[14%] bottom-1",
    duration: 8.4,
    delay: 0.9,
    x: 9,
    y: -9,
    r: 1.7,
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

          {swingingNotes.map((note) => (
            <motion.div
              key={note.text}
              animate={{
                x: [0, note.x, -note.x * 0.4, 0],
                y: [0, note.y, -note.y * 0.45, 0],
                rotate: [0, note.r, -note.r * 0.6, 0],
              }}
              className={`pointer-events-none absolute hidden rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm md:block ${note.className}`}
              transition={{
                duration: note.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: note.delay,
              }}
            >
              {note.text}
            </motion.div>
          ))}

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
                  label: "Confidence",
                  value: Number(point.confidence ?? 0),
                },
                {
                  color: "#0d9488",
                  label: "Momentum",
                  value: Number(point.momentum ?? 0),
                },
              ]}
            >
              <p className="text-chart-tooltip-muted text-xs">
                Refined motion mode enabled.
              </p>
            </ChartTooltip>
          </BarChart>
        </div>
      </div>
    </section>
  );
}
