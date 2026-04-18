/**
 * prisma/seed.ts
 * FairGig demo seed — inserts realistic data that triggers anomaly detection.
 * Run: pnpm seed  (mapped to: tsx --tsconfig tsconfig.json prisma/seed.ts)
 *
 * Design notes:
 *  - Idempotent: uses upsert where possible, manual existence checks otherwise.
 *  - Weeks 1-8  → 20 % deduction rate  (normal baseline).
 *  - Weeks 9-12 → ~31 % deduction rate (anomaly trigger).
 *  - DailyPlatformStat mirrors same pattern for the advocate analytics panel.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  GrievanceCategory,
  GrievanceStatus,
  PrismaClient,
  Role,
  VerificationStatus,
  WorkerCategory,
} from '../src/generated/prisma/client';

// ---------------------------------------------------------------------------
// Bootstrap a standalone Prisma client (same pattern as src/lib/db.ts)
// ---------------------------------------------------------------------------
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as ConstructorParameters<
  typeof PrismaClient
>[0]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const d = (iso: string): Date => new Date(iso);

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function main() {
  // ── PLATFORMS ─────────────────────────────────────────────────────────────
  const platformDefs = [
    { name: 'Careem', slug: 'careem' },
    { name: 'Foodpanda', slug: 'foodpanda' },
    { name: 'Bykea', slug: 'bykea' },
  ] as const;

  const platforms: Record<string, string> = {}; // slug → id

  for (const p of platformDefs) {
    const record = await db.platform.upsert({
      where: { slug: p.slug },
      update: {},
      create: { name: p.name, slug: p.slug },
    });
    platforms[p.slug] = record.id;
  }

  // ── DEMO USERS ────────────────────────────────────────────────────────────
  const userDefs = [
    {
      email: 'ali@fairgig.demo',
      fullName: 'Ali Raza',
      role: Role.WORKER,
      cityZone: 'Gulberg',
      category: WorkerCategory.RIDE_HAILING,
    },
    {
      email: 'sara@fairgig.demo',
      fullName: 'Sara Khan',
      role: Role.VERIFIER,
      cityZone: null,
      category: null,
    },
    {
      email: 'imran@fairgig.demo',
      fullName: 'Dr. Imran',
      role: Role.ADVOCATE,
      cityZone: null,
      category: null,
    },
  ] as const;

  const users: Record<string, string> = {}; // email → id

  for (const u of userDefs) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (existing) {
      users[u.email] = existing.id;
    } else {
      const created = await db.user.create({
        data: {
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          cityZone: u.cityZone ?? undefined,
          category: u.category ?? undefined,
        },
      });
      users[u.email] = created.id;
    }
  }

  const aliId = users['ali@fairgig.demo'];
  const careemId = platforms['careem'];
  const foodpandaId = platforms['foodpanda'];
  const bykeaId = platforms['bykea'];

  // ── ALI'S SHIFT LOGS ─────────────────────────────────────────────────────
  //
  // verificationStatus mapping:
  //   weeks 1-8  → CONFIRMED  (schema uses CONFIRMED, not VERIFIED)
  //   weeks 9-12 → PENDING
  //
  const shiftDefs = [
    // Normal baseline — 20 % deduction
    { date: '2026-01-06', gross: 4000, deduction: 800,  net: 3200, hours: 8.0, status: VerificationStatus.CONFIRMED },
    { date: '2026-01-13', gross: 3800, deduction: 760,  net: 3040, hours: 7.5, status: VerificationStatus.CONFIRMED },
    { date: '2026-01-20', gross: 4200, deduction: 840,  net: 3360, hours: 8.5, status: VerificationStatus.CONFIRMED },
    { date: '2026-01-27', gross: 4100, deduction: 820,  net: 3280, hours: 8.0, status: VerificationStatus.CONFIRMED },
    { date: '2026-02-03', gross: 4000, deduction: 800,  net: 3200, hours: 8.0, status: VerificationStatus.CONFIRMED },
    { date: '2026-02-10', gross: 3600, deduction: 720,  net: 2880, hours: 7.0, status: VerificationStatus.CONFIRMED },
    { date: '2026-02-17', gross: 4300, deduction: 860,  net: 3440, hours: 8.5, status: VerificationStatus.CONFIRMED },
    { date: '2026-02-24', gross: 4000, deduction: 800,  net: 3200, hours: 8.0, status: VerificationStatus.CONFIRMED },
    // Anomaly weeks — ~31 % deduction
    { date: '2026-03-03', gross: 4100, deduction: 1271, net: 2829, hours: 8.0, status: VerificationStatus.PENDING },
    { date: '2026-03-10', gross: 4000, deduction: 1280, net: 2720, hours: 8.0, status: VerificationStatus.PENDING },
    { date: '2026-03-17', gross: 3900, deduction: 1209, net: 2691, hours: 7.5, status: VerificationStatus.PENDING },
    { date: '2026-03-24', gross: 4200, deduction: 1302, net: 2898, hours: 8.5, status: VerificationStatus.PENDING },
  ] as const;

  let shiftsInserted = 0;

  for (const s of shiftDefs) {
    const shiftDate = d(s.date);

    // Skip if a record already exists for this worker+platform+date combo
    const existing = await db.shiftLog.findFirst({
      where: {
        workerId: aliId,
        platformId: careemId,
        shiftDate,
      },
    });

    if (!existing) {
      await db.shiftLog.create({
        data: {
          workerId: aliId,
          platformId: careemId,
          shiftDate,
          hoursWorked: s.hours,
          grossEarned: s.gross,
          platformDeductions: s.deduction,
          netReceived: s.net,
          verificationStatus: s.status,
        },
      });
      shiftsInserted++;
    }
  }

  // ── GRIEVANCES ────────────────────────────────────────────────────────────
  const grievanceDefs = [
    {
      platformId: careemId,
      category: GrievanceCategory.COMMISSION_CHANGE,
      title: 'Commission cut from 20% to 31% without notice',
      description:
        'My commission was cut from 20% to 31% with no notice in March. I only noticed because my net pay dropped significantly.',
      status: GrievanceStatus.OPEN,
    },
    {
      platformId: careemId,
      category: GrievanceCategory.COMMISSION_CHANGE,
      title: 'Sudden overnight commission hike',
      description:
        'Same problem as other Careem drivers — deduction jumped overnight.',
      status: GrievanceStatus.OPEN,
    },
    {
      platformId: foodpandaId,
      category: GrievanceCategory.PAYMENT_DISPUTE,
      title: 'Payment delayed twice this month',
      description: 'Payment delayed by 5 days twice this month.',
      status: GrievanceStatus.ESCALATED,
    },
    {
      platformId: bykeaId,
      category: GrievanceCategory.ACCOUNT_DEACTIVATION,
      title: 'Account deactivated without explanation',
      description: 'Account deactivated for 2 days without explanation.',
      status: GrievanceStatus.OPEN,
    },
    {
      platformId: careemId,
      category: GrievanceCategory.COMMISSION_CHANGE,
      title: 'March deduction issue — partially resolved',
      description:
        'March deduction issue — partially addressed by platform.',
      status: GrievanceStatus.RESOLVED,
    },
  ];

  let grievancesInserted = 0;

  for (const g of grievanceDefs) {
    const existing = await db.grievance.findFirst({
      where: {
        workerId: aliId,
        platformId: g.platformId,
        category: g.category,
        title: g.title,
      },
    });

    if (!existing) {
      await db.grievance.create({
        data: {
          workerId: aliId,
          platformId: g.platformId,
          category: g.category,
          title: g.title,
          description: g.description,
          status: g.status,
        },
      });
      grievancesInserted++;
    }
  }

  // ── DAILY PLATFORM STATS ──────────────────────────────────────────────────
  //
  // DailyPlatformStat fields (exact schema names):
  //   medianNetEarned, avgCommissionPct, p25NetEarned, p75NetEarned
  //
  // Weeks 1-8  (Jan 6 – Feb 24): avgCommissionPct = 0.20
  // Weeks 9-12 (Mar 3 – Mar 24): avgCommissionPct = 0.31
  //
  const normalWeeks = [
    '2026-01-06',
    '2026-01-13',
    '2026-01-20',
    '2026-01-27',
    '2026-02-03',
    '2026-02-10',
    '2026-02-17',
    '2026-02-24',
  ] as const;

  const anomalyWeeks = [
    '2026-03-03',
    '2026-03-10',
    '2026-03-17',
    '2026-03-24',
  ] as const;

  let statsInserted = 0;

  for (const dateStr of normalWeeks) {
    const result = await db.dailyPlatformStat.upsert({
      where: {
        platformId_cityZone_category_statDate: {
          platformId: careemId,
          cityZone: 'Gulberg',
          category: WorkerCategory.RIDE_HAILING,
          statDate: d(dateStr),
        },
      },
      update: {},
      create: {
        platformId: careemId,
        cityZone: 'Gulberg',
        category: WorkerCategory.RIDE_HAILING,
        statDate: d(dateStr),
        workerCount: 12,
        medianNetEarned: 3200,
        avgCommissionPct: 0.20,
        p25NetEarned: 2880,
        p75NetEarned: 3440,
      },
    });
    // Upsert always "touches" the row; count creates only
    void result;
    statsInserted++;
  }

  for (const dateStr of anomalyWeeks) {
    await db.dailyPlatformStat.upsert({
      where: {
        platformId_cityZone_category_statDate: {
          platformId: careemId,
          cityZone: 'Gulberg',
          category: WorkerCategory.RIDE_HAILING,
          statDate: d(dateStr),
        },
      },
      update: {},
      create: {
        platformId: careemId,
        cityZone: 'Gulberg',
        category: WorkerCategory.RIDE_HAILING,
        statDate: d(dateStr),
        workerCount: 12,
        medianNetEarned: 2760,
        avgCommissionPct: 0.31,
        p25NetEarned: 2691,
        p75NetEarned: 2898,
      },
    });
    statsInserted++;
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log(
    `Seeded: ${Object.keys(platforms).length} platforms, ` +
    `${Object.keys(users).length} users, ` +
    `${shiftsInserted} shifts, ` +
    `${grievancesInserted} grievances, ` +
    `${statsInserted} daily stats`
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
