import db from '@/lib/db';
import {
  CertificateStatus,
  GrievanceCategory,
  GrievanceStatus,
  Role,
  ScreenshotStatus,
  VerificationStatus,
  WorkerCategory,
} from '@/generated/prisma/enums';
import db from '@/lib/db';

// cspell:words Bykea bykea Foodpanda foodpanda Careem careem indrive

const SEED_TAG = '[seed-analytics]';
const SEED_EMAIL_DOMAIN = 'seed.fairgig.local';
const SEED_FILE_PREFIX = 'seed/analytics/';
const TOTAL_WEEKS = 56;
const SEED_SNAPSHOT_DAYS = 42;

type PlatformSeed = {
  name: string;
  slug: string;
  baseCommission: number;
  incomeBias: number;
};

type SeedWorkerProfile = {
  fullName: string;
  email: string;
  cityZone: string;
  category: WorkerCategory;
  baseHourly: number;
  volatility: number;
  joinDaysAgo: number;
  primaryPlatforms: string[];
};

type SeedUserProfile = {
  fullName: string;
  email: string;
  cityZone: string;
  role: Role;
  joinDaysAgo: number;
};

type SeedWorker = {
  id: string;
  fullName: string;
  cityZone: string;
  category: WorkerCategory;
  profile: SeedWorkerProfile;
};

type SeedUser = {
  id: string;
  fullName: string;
  email: string;
};

type SeedPlatform = {
  id: string;
  name: string;
  slug: string;
  baseCommission: number;
  incomeBias: number;
};

type SeedShiftBlueprint = {
  workerId: string;
  platformId: string;
  shiftDate: Date;
  hoursWorked: number;
  grossEarned: number;
  platformDeductions: number;
  netReceived: number;
  verificationStatus: VerificationStatus;
  importedViaCsv: boolean;
  notes: string;
};

type SeedShiftRecord = {
  id: string;
  workerId: string;
  platformId: string;
  shiftDate: Date;
  hoursWorked: unknown;
  grossEarned: unknown;
  platformDeductions: unknown;
  netReceived: unknown;
  verificationStatus: VerificationStatus;
};

type GrievanceSeedSummary = {
  grievances: number;
  tags: number;
  escalations: number;
};

const PLATFORM_SEEDS: PlatformSeed[] = [
  {
    name: 'Bykea',
    slug: 'bykea',
    baseCommission: 0.24,
    incomeBias: 0.96,
  },
  {
    name: 'Foodpanda',
    slug: 'foodpanda',
    baseCommission: 0.26,
    incomeBias: 1.04,
  },
  {
    name: 'Careem',
    slug: 'careem',
    baseCommission: 0.2,
    incomeBias: 1.08,
  },
  {
    name: 'Uber',
    slug: 'uber',
    baseCommission: 0.22,
    incomeBias: 1.1,
  },
  {
    name: 'inDrive',
    slug: 'indrive',
    baseCommission: 0.17,
    incomeBias: 1.0,
  },
];

const WORKER_PROFILES: SeedWorkerProfile[] = [
  {
    fullName: 'Aamir Riaz',
    email: `aamir.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Gulberg',
    category: WorkerCategory.RIDE_HAILING,
    baseHourly: 575,
    volatility: 0.12,
    joinDaysAgo: 420,
    primaryPlatforms: ['careem', 'uber', 'indrive'],
  },
  {
    fullName: 'Bilal Ahmed',
    email: `bilal.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'DHA',
    category: WorkerCategory.RIDE_HAILING,
    baseHourly: 610,
    volatility: 0.11,
    joinDaysAgo: 380,
    primaryPlatforms: ['uber', 'careem', 'bykea'],
  },
  {
    fullName: 'Haris Khan',
    email: `haris.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Johar Town',
    category: WorkerCategory.FOOD_DELIVERY,
    baseHourly: 520,
    volatility: 0.16,
    joinDaysAgo: 310,
    primaryPlatforms: ['foodpanda', 'bykea', 'indrive'],
  },
  {
    fullName: 'Imran Asif',
    email: `imran.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Samanabad',
    category: WorkerCategory.FOOD_DELIVERY,
    baseHourly: 495,
    volatility: 0.18,
    joinDaysAgo: 295,
    primaryPlatforms: ['foodpanda', 'bykea', 'careem'],
  },
  {
    fullName: 'Kamran Shah',
    email: `kamran.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Model Town',
    category: WorkerCategory.RIDE_HAILING,
    baseHourly: 560,
    volatility: 0.13,
    joinDaysAgo: 260,
    primaryPlatforms: ['careem', 'indrive', 'uber'],
  },
  {
    fullName: 'Naveed Iqbal',
    email: `naveed.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Cantt',
    category: WorkerCategory.FOOD_DELIVERY,
    baseHourly: 510,
    volatility: 0.15,
    joinDaysAgo: 240,
    primaryPlatforms: ['foodpanda', 'bykea', 'uber'],
  },
  {
    fullName: 'Rashid Ali',
    email: `rashid.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Gulberg',
    category: WorkerCategory.RIDE_HAILING,
    baseHourly: 590,
    volatility: 0.14,
    joinDaysAgo: 80,
    primaryPlatforms: ['uber', 'careem', 'indrive'],
  },
  {
    fullName: 'Saad Tariq',
    email: `saad.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'DHA',
    category: WorkerCategory.FOOD_DELIVERY,
    baseHourly: 500,
    volatility: 0.18,
    joinDaysAgo: 62,
    primaryPlatforms: ['foodpanda', 'bykea', 'careem'],
  },
  {
    fullName: 'Usman Javed',
    email: `usman.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Johar Town',
    category: WorkerCategory.RIDE_HAILING,
    baseHourly: 550,
    volatility: 0.15,
    joinDaysAgo: 49,
    primaryPlatforms: ['indrive', 'uber', 'careem'],
  },
  {
    fullName: 'Waqar Ahmed',
    email: `waqar.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Samanabad',
    category: WorkerCategory.FOOD_DELIVERY,
    baseHourly: 485,
    volatility: 0.2,
    joinDaysAgo: 34,
    primaryPlatforms: ['bykea', 'foodpanda', 'indrive'],
  },
];

const ADVOCATE_PROFILES: SeedUserProfile[] = [
  {
    fullName: 'Sara Malik',
    email: `sara.advocate@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Lahore',
    role: Role.ADVOCATE,
    joinDaysAgo: 300,
  },
  {
    fullName: 'Faisal Noor',
    email: `faisal.advocate@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Lahore',
    role: Role.ADVOCATE,
    joinDaysAgo: 180,
  },
];

const VERIFIER_PROFILES: SeedUserProfile[] = [
  {
    fullName: 'Maha Verifier',
    email: `maha.verifier@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Lahore',
    role: Role.VERIFIER,
    joinDaysAgo: 250,
  },
  {
    fullName: 'Yasir Verifier',
    email: `yasir.verifier@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Lahore',
    role: Role.VERIFIER,
    joinDaysAgo: 200,
  },
];

const GRIEVANCE_CATEGORIES: GrievanceCategory[] = [
  GrievanceCategory.COMMISSION_CHANGE,
  GrievanceCategory.ACCOUNT_DEACTIVATION,
  GrievanceCategory.PAYMENT_DISPUTE,
  GrievanceCategory.UNFAIR_RATING,
  GrievanceCategory.SAFETY_CONCERN,
  GrievanceCategory.OTHER,
];

const CATEGORY_TAGS: Record<string, string[]> = {
  COMMISSION_CHANGE: ['seed-commission-spike', 'seed-unfair-deduction'],
  ACCOUNT_DEACTIVATION: ['seed-account-lock', 'seed-unjust-suspension'],
  PAYMENT_DISPUTE: ['seed-payment-gap', 'seed-payout-delay'],
  UNFAIR_RATING: ['seed-rating-bias', 'seed-algorithm-fairness'],
  SAFETY_CONCERN: ['seed-safety-risk', 'seed-route-safety'],
  OTHER: ['seed-general-issue', 'seed-worker-rights'],
};

function randomUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toDateOnlyUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfUtcWeek(date: Date): Date {
  const day = (date.getUTCDay() + 6) % 7;
  return addUtcDays(toDateOnlyUtc(date), -day);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateOnlyUtc(next);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return toIsoDate(startOfUtcMonth(date));
}

function parseMonthKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toFixedNumeric(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function pickPrimaryPlatform(profile: SeedWorkerProfile, seed: number): string {
  const index = Math.floor(randomUnit(seed) * profile.primaryPlatforms.length);
  return profile.primaryPlatforms[index] ?? profile.primaryPlatforms[0];
}

async function upsertPlatforms(): Promise<Map<string, SeedPlatform>> {
  const map = new Map<string, SeedPlatform>();

  for (const platformSeed of PLATFORM_SEEDS) {
    const platform = await db.platform.upsert({
      where: { slug: platformSeed.slug },
      update: { name: platformSeed.name },
      create: {
        name: platformSeed.name,
        slug: platformSeed.slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    map.set(platformSeed.slug, {
      id: platform.id,
      name: platform.name,
      slug: platform.slug,
      baseCommission: platformSeed.baseCommission,
      incomeBias: platformSeed.incomeBias,
    });
  }

  return map;
}

async function upsertWorkerUsers(): Promise<SeedWorker[]> {
  const workers: SeedWorker[] = [];
  const today = toDateOnlyUtc(new Date());

  for (const profile of WORKER_PROFILES) {
    const user = await db.user.upsert({
      where: { email: profile.email },
      update: {
        fullName: profile.fullName,
        role: Role.WORKER,
        cityZone: profile.cityZone,
        category: profile.category,
        isActive: true,
      },
      create: {
        email: profile.email,
        fullName: profile.fullName,
        role: Role.WORKER,
        cityZone: profile.cityZone,
        category: profile.category,
        isActive: true,
        createdAt: addUtcDays(today, -profile.joinDaysAgo),
      },
      select: {
        id: true,
        fullName: true,
        cityZone: true,
        category: true,
      },
    });

  const rows = userIds.flatMap((workerId, userIdx) => {
    return [0, 1].map((slot) => {
      const grossEarned = 2600 + userIdx * 220 + slot * 180;
      const platformDeductions = Math.round(grossEarned * 0.19);
      const netReceived = grossEarned - platformDeductions;

      return {
        workerId,
        platformId: platformIds[(userIdx + slot) % platformIds.length],
        shiftDate: getIsoDateOffset(-(userIdx * 2 + slot + 1)),
        hoursWorked: '8.00',
        grossEarned: grossEarned.toFixed(2),
        platformDeductions: platformDeductions.toFixed(2),
        netReceived: netReceived.toFixed(2),
        verificationStatus:
          slot % 2 === 0 ? VerificationStatus.CONFIRMED : VerificationStatus.PENDING,
        importedViaCsv: slot % 2 === 0,
        notes: `[seed] Shift ${slot + 1} for worker ${workerId}`,
      };
    });
  });

  await db.grievanceEscalation.deleteMany({
    where: {
      OR: [
        {
          note: {
            contains: SEED_TAG,
          },
        },
        {
          advocateId: {
            in: seedUserIds,
          },
        },
      ],
    },
  });
}

async function seedScreenshots(shiftLogs: Array<{ id: string }>, userIds: string[]) {
  await db.screenshot.deleteMany({
    where: {
      fileKey: {
        startsWith: SEED_FILE_PREFIX,
      },
    },
  });

  const screenshotRows = shiftLogs.slice(0, Math.min(shiftLogs.length, 8)).map((log, idx) => ({
    shiftLogId: log.id,
    verifierId: userIds[(idx + 1) % userIds.length],
    fileUrl: `https://cdn.example.org/seed/screenshot-${idx + 1}.png`,
    fileKey: `seed/screenshot-${idx + 1}.png`,
    status:
      idx % 2 === 0 ? ScreenshotStatus.CONFIRMED : ScreenshotStatus.PENDING,
    verifierNotes: idx % 2 === 0 ? '[seed] Looks valid.' : '[seed] Pending review.',
    reviewedAt: idx % 2 === 0 ? getIsoDateOffset(-idx) : null,
  }));

  await db.screenshot.createMany({ data: screenshotRows });
}

async function seedAnomalyFlags(
  shiftLogs: Array<{ id: string; workerId: string }>,
  userIds: string[],
) {
  await db.anomalyFlag.deleteMany({
    where: {
      flagType: {
        startsWith: 'seed_',
      },
    },
  });

  await db.grievance.deleteMany({
    where: {
      title: {
        startsWith: SEED_TAG,
      },
    },
  });

  await db.vulnerabilityFlag.deleteMany({
    where: {
      workerId: {
        in: seedWorkerIds,
      },
    },
  });

  await db.incomeCertificate.deleteMany({
    where: {
      OR: [
        {
          workerId: {
            in: seedWorkerIds,
          },
        },
        {
          htmlSnapshot: {
            contains: 'seed-certificate',
          },
        },
      ],
    },
  });

  await db.shiftLog.deleteMany({
    where: {
      notes: {
        contains: SEED_TAG,
      },
    },
  });
}

function buildShiftBlueprints(
  workers: SeedWorker[],
  platformsBySlug: Map<string, SeedPlatform>,
): SeedShiftBlueprint[] {
  const today = toDateOnlyUtc(new Date());
  const currentWeekStart = startOfUtcWeek(today);
  const rows: SeedShiftBlueprint[] = [];
  const dayPattern = [0, 1, 3, 5, 6] as const;

  for (const [workerIndex, worker] of workers.entries()) {
    for (let weekOffset = TOTAL_WEEKS - 1; weekOffset >= 0; weekOffset -= 1) {
      const weekStart = addUtcDays(currentWeekStart, -weekOffset * 7);
      const seasonalWave = 1 + Math.sin((weekOffset + workerIndex) / 3.2) * 0.09;
      const stressPeriod =
        (workerIndex % 3 === 0 && weekOffset >= 8 && weekOffset <= 13) ||
        (workerIndex % 4 === 1 && weekOffset >= 20 && weekOffset <= 23)
          ? 0.82
          : 1;

      const shiftsThisWeek = 3 + ((workerIndex + weekOffset) % 3);

      for (let shiftIndex = 0; shiftIndex < shiftsThisWeek; shiftIndex += 1) {
        const shiftDate = addUtcDays(weekStart, dayPattern[shiftIndex] ?? 6);

        if (shiftDate > today) {
          continue;
        }

        const platformRandomSeed = workerIndex * 100_000 + weekOffset * 100 + shiftIndex;
        const occasionalCrossPlatform = randomUnit(platformRandomSeed + 11) > 0.87;
        const platformSlug = occasionalCrossPlatform
          ? PLATFORM_SEEDS[(workerIndex + weekOffset + shiftIndex) % PLATFORM_SEEDS.length]
              .slug
          : pickPrimaryPlatform(worker.profile, platformRandomSeed);

        const platform = platformsBySlug.get(platformSlug);

        if (!platform) {
          continue;
        }

        const hours = clamp(
          5.25 + randomUnit(platformRandomSeed + 21) * 5.75,
          4.25,
          12,
        );

        const workerNoise =
          1 +
          (randomUnit(platformRandomSeed + 31) - 0.5) *
            Math.max(0.04, worker.profile.volatility);

        const marketNoise = 0.92 + randomUnit(platformRandomSeed + 41) * 0.2;

        const grossHourly =
          worker.profile.baseHourly *
          platform.incomeBias *
          seasonalWave *
          stressPeriod *
          workerNoise *
          marketNoise;

        const grossEarned = Math.max(850, hours * grossHourly);

        const bykeaShock =
          platform.slug === 'bykea' && weekOffset >= 12 && weekOffset <= 18 ? 0.07 : 0;
        const foodpandaShock =
          platform.slug === 'foodpanda' && weekOffset >= 5 && weekOffset <= 10
            ? 0.045
            : 0;

        const commissionRate = clamp(
          platform.baseCommission +
            bykeaShock +
            foodpandaShock +
            (randomUnit(platformRandomSeed + 51) - 0.5) * 0.06,
          0.12,
          0.38,
        );

        const platformDeductions = grossEarned * commissionRate;
        const netReceived = Math.max(0, grossEarned - platformDeductions);

        const verificationRoll = randomUnit(platformRandomSeed + 61);
        let verificationStatus: VerificationStatus = VerificationStatus.CONFIRMED;

        if (verificationRoll > 0.9) {
          verificationStatus = VerificationStatus.PENDING;
        }

        if (verificationRoll > 0.97 || commissionRate >= 0.33) {
          verificationStatus = VerificationStatus.FLAGGED;
        }

        if (verificationRoll < 0.02) {
          verificationStatus = VerificationStatus.UNVERIFIABLE;
        }

        rows.push({
          workerId: worker.id,
          platformId: platform.id,
          shiftDate,
          hoursWorked: Number(hours.toFixed(2)),
          grossEarned: Number(grossEarned.toFixed(2)),
          platformDeductions: Number(platformDeductions.toFixed(2)),
          netReceived: Number(netReceived.toFixed(2)),
          verificationStatus,
          importedViaCsv: randomUnit(platformRandomSeed + 71) > 0.83,
          notes: `${SEED_TAG} worker=${worker.id} week=${weekOffset} shift=${shiftIndex}`,
        });
      }
    }
  }

  return rows;
}

async function seedShiftLogs(rows: SeedShiftBlueprint[]): Promise<SeedShiftRecord[]> {
  await db.shiftLog.createMany({
    data: rows.map((row) => ({
      workerId: row.workerId,
      platformId: row.platformId,
      shiftDate: row.shiftDate,
      hoursWorked: toFixedNumeric(row.hoursWorked),
      grossEarned: toFixedNumeric(row.grossEarned),
      platformDeductions: toFixedNumeric(row.platformDeductions),
      netReceived: toFixedNumeric(row.netReceived),
      verificationStatus: row.verificationStatus,
      importedViaCsv: row.importedViaCsv,
      notes: row.notes,
    })),
  });

  return db.shiftLog.findMany({
    where: {
      notes: {
        contains: SEED_TAG,
      },
    },
    select: {
      id: true,
      workerId: true,
      platformId: true,
      shiftDate: true,
      hoursWorked: true,
      grossEarned: true,
      platformDeductions: true,
      netReceived: true,
      verificationStatus: true,
    },
    orderBy: [{ shiftDate: 'asc' }, { createdAt: 'asc' }],
  });
}

async function seedScreenshots(
  shiftLogs: SeedShiftRecord[],
  verifierIds: string[],
): Promise<number> {
  const fallbackVerifierId = verifierIds[0];

  if (!fallbackVerifierId) {
    return 0;
  }

  const rows = shiftLogs
    .filter((_, index) => index % 7 === 0)
    .map((log, index) => {
      const statusCycle = [
        ScreenshotStatus.CONFIRMED,
        ScreenshotStatus.PENDING,
        ScreenshotStatus.FLAGGED,
        ScreenshotStatus.UNVERIFIABLE,
      ] as const;

      const status = statusCycle[index % statusCycle.length];

      return {
        shiftLogId: log.id,
        verifierId: verifierIds[index % verifierIds.length] ?? fallbackVerifierId,
        fileUrl: `https://cdn.example.org/${SEED_FILE_PREFIX}screenshot-${index + 1}.png`,
        fileKey: `${SEED_FILE_PREFIX}screenshot-${index + 1}.png`,
        status,
        verifierNotes:
          status === ScreenshotStatus.CONFIRMED
            ? `${SEED_TAG} Verified evidence.`
            : status === ScreenshotStatus.PENDING
              ? `${SEED_TAG} Awaiting review.`
              : `${SEED_TAG} Requires manual verification.`,
        reviewedAt:
          status === ScreenshotStatus.PENDING
            ? null
            : addUtcDays(log.shiftDate, 1),
      };
    });

  if (rows.length > 0) {
    await db.screenshot.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  return rows.length;
}

async function seedAnomalyFlags(shiftLogs: SeedShiftRecord[]): Promise<number> {
  const rows = shiftLogs
    .filter((log, index) => {
      const gross = toNumber(log.grossEarned);
      const deductions = toNumber(log.platformDeductions);
      const deductionRate = gross <= 0 ? 0 : deductions / gross;

      return deductionRate >= 0.29 || randomUnit(index * 19 + 7) > 0.965;
    })
    .map((log, index) => {
      const gross = toNumber(log.grossEarned);
      const deductions = toNumber(log.platformDeductions);
      const deductionRate = gross <= 0 ? 0 : deductions / gross;

      const severe = deductionRate >= 0.33;
      const flagType = severe ? 'seed_commission_spike' : 'seed_income_drop';

      return {
        workerId: log.workerId,
        shiftLogId: log.id,
        flagType,
        severity: severe ? 'high' : deductionRate >= 0.27 ? 'medium' : 'low',
        explanation: `${SEED_TAG} Commission and payout pattern diverged from recent baseline.`,
        zScore: toFixedNumeric(1.1 + deductionRate * 6 + randomUnit(index + 41), 4),
      };
    });

  if (rows.length > 0) {
    await db.anomalyFlag.createMany({ data: rows });
  }

  return rows.length;
}

async function seedVulnerabilityFlags(
  shiftLogs: SeedShiftRecord[],
  workerIds: string[],
): Promise<number> {
  const byWorkerMonth = new Map<string, Map<string, number>>();

  for (const log of shiftLogs) {
    const workerMap = byWorkerMonth.get(log.workerId) ?? new Map<string, number>();
    const key = monthKey(log.shiftDate);
    workerMap.set(key, (workerMap.get(key) ?? 0) + toNumber(log.netReceived));
    byWorkerMonth.set(log.workerId, workerMap);
  }

  let total = 0;

  for (const workerId of workerIds) {
    const monthMap = byWorkerMonth.get(workerId) ?? new Map<string, number>();
    const keys = [...monthMap.keys()].sort();
    let createdForWorker = 0;

    for (let index = 1; index < keys.length; index += 1) {
      const prevMonthKey = keys[index - 1];
      const currMonthKey = keys[index];
      const prevMonthNet = monthMap.get(prevMonthKey) ?? 0;
      const currMonthNet = monthMap.get(currMonthKey) ?? 0;

      if (prevMonthNet <= 0) {
        continue;
      }

      const dropPct = (prevMonthNet - currMonthNet) / prevMonthNet;

      if (dropPct < 0.2) {
        continue;
      }

      await db.vulnerabilityFlag.upsert({
        where: {
          workerId_flagMonth: {
            workerId,
            flagMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        update: {
          prevMonthNet: toFixedNumeric(prevMonthNet),
          currMonthNet: toFixedNumeric(currMonthNet),
          dropPct: toFixedNumeric(dropPct, 4),
          resolved: false,
        },
        create: {
          workerId,
          flagMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          prevMonthNet: (54000 + idx * 1400).toFixed(2),
          currMonthNet: (42000 + idx * 1200).toFixed(2),
          dropPct: '0.2200',
          resolved: false,
        },
      });

      createdForWorker += 1;
      total += 1;
    }

    if (createdForWorker === 0 && keys.length >= 2) {
      const latestMonthKey = keys[keys.length - 1];
      const previousMonthKey = keys[keys.length - 2];
      const prevMonthNet = monthMap.get(previousMonthKey) ?? 0;
      const syntheticCurr = prevMonthNet * 0.78;

      if (prevMonthNet > 0) {
        await db.vulnerabilityFlag.upsert({
          where: {
            workerId_flagMonth: {
              workerId,
              flagMonth: parseMonthKey(latestMonthKey),
            },
          },
          update: {
            prevMonthNet: toFixedNumeric(prevMonthNet),
            currMonthNet: toFixedNumeric(syntheticCurr),
            dropPct: toFixedNumeric(0.22, 4),
            resolved: false,
          },
          create: {
            workerId,
            flagMonth: parseMonthKey(latestMonthKey),
            prevMonthNet: toFixedNumeric(prevMonthNet),
            currMonthNet: toFixedNumeric(syntheticCurr),
            dropPct: toFixedNumeric(0.22, 4),
            resolved: false,
          },
        });

        total += 1;
      }
    }
  }

  return total;
}

async function seedGrievances(
  workers: SeedWorker[],
  advocates: SeedUser[],
  platforms: SeedPlatform[],
): Promise<GrievanceSeedSummary> {
  const today = toDateOnlyUtc(new Date());
  const currentWeekStart = startOfUtcWeek(today);
  const fallbackAdvocate = advocates[0]?.id ?? workers[0]?.id;

  if (!fallbackAdvocate) {
    return { grievances: 0, tags: 0, escalations: 0 };
  }

  const created = [] as Array<{
    id: string;
    category: string;
  }>;

  for (let weekOffset = 34; weekOffset >= 0; weekOffset -= 1) {
    const weekStart = addUtcDays(currentWeekStart, -weekOffset * 7);
    const issuesThisWeek = 2 + (weekOffset % 3);

    for (let issueIndex = 0; issueIndex < issuesThisWeek; issueIndex += 1) {
      const worker = workers[(weekOffset + issueIndex) % workers.length];
      const platform = platforms[(weekOffset * 2 + issueIndex) % platforms.length];
      const category =
        GRIEVANCE_CATEGORIES[(weekOffset + issueIndex) % GRIEVANCE_CATEGORIES.length];

      const createdAt = addUtcDays(weekStart, (issueIndex * 2) % 6);
      const status =
        weekOffset % 7 === 0
          ? GrievanceStatus.ESCALATED
          : weekOffset % 2 === 0
            ? GrievanceStatus.OPEN
            : GrievanceStatus.TAGGED;

      const record = await db.grievance.create({
        data: {
          workerId: worker.id,
          platformId: platform.id,
          category,
          title: `${SEED_TAG} ${category} signal ${weekOffset}-${issueIndex}`,
          description: `${SEED_TAG} ${worker.cityZone} workers reported ${category.toLowerCase().replaceAll('_', ' ')} on ${platform.name}.`,
          status,
          isAnonymous: issueIndex % 5 === 0,
          clusterId: `seed-cluster-${category.toLowerCase()}`,
          createdAt,
        },
        select: {
          id: true,
          category: true,
        },
      });

      created.push(record);
    }
  }

  const tagRows = created.flatMap((grievance, index) => {
    const tags = CATEGORY_TAGS[grievance.category] ?? CATEGORY_TAGS.OTHER;

    return tags.slice(0, 2).map((tag, tagIndex) => ({
      grievanceId: grievance.id,
      advocateId: advocates[(index + tagIndex) % advocates.length]?.id ?? fallbackAdvocate,
      tag,
    }));
  });

  const escalationRows = created
    .filter((_, index) => index % 3 === 0)
    .map((grievance, index) => ({
      grievanceId: grievance.id,
      advocateId: advocates[index % advocates.length]?.id ?? fallbackAdvocate,
      note: `${SEED_TAG} Escalated for collective legal evidence review.`,
    }));

  if (tagRows.length > 0) {
    await db.grievanceTag.createMany({
      data: tagRows,
      skipDuplicates: true,
    });
  }

  if (escalationRows.length > 0) {
    await db.grievanceEscalation.createMany({
      data: escalationRows,
    });
  }

  return {
    grievances: created.length,
    tags: tagRows.length,
    escalations: escalationRows.length,
  };
}

async function seedIncomeCertificates(userIds: string[], platformNames: string[]) {
  await db.incomeCertificate.deleteMany({
    where: {
      htmlSnapshot: {
        contains: 'seed-certificate',
      },
    },
  });

  await db.incomeCertificate.createMany({
    data: userIds.map((workerId, idx) => ({
      workerId,
      fromDate: getIsoDateOffset(-30),
      toDate: getIsoDateOffset(-1),
      totalVerified: (38000 + idx * 1500).toFixed(2),
      shiftCount: 12 + idx,
      platformsList: platformNames,
      htmlSnapshot: `<html><body>seed-certificate-${idx + 1}</body></html>`,
      status: CertificateStatus.GENERATED,
      expiresAt: addUtcDays(toDate, 45),
    };
  });

  if (rows.length > 0) {
    await db.incomeCertificate.createMany({ data: rows });
  }

  return rows.length;
}

async function seedDailyStats(platformIds: string[]) {
  await Promise.all(
    platformIds.map((platformId, idx) =>
      db.dailyPlatformStat.upsert({
        where: {
          platformId_cityZone_category_statDate: {
            platformId,
            cityZone: 'Lahore',
            category: WorkerCategory.FOOD_DELIVERY,
            statDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        update: {
          workerCount: 100 + idx * 10,
          medianNetEarned: (56000 + idx * 2500).toFixed(2),
          avgCommissionPct: '0.1850',
          p25NetEarned: (43000 + idx * 1800).toFixed(2),
          p75NetEarned: (69000 + idx * 2300).toFixed(2),
        },
        create: {
          platformId,
          cityZone: 'Lahore',
          category: WorkerCategory.FOOD_DELIVERY,
          statDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          workerCount: 100 + idx * 10,
          medianNetEarned: (56000 + idx * 2500).toFixed(2),
          avgCommissionPct: '0.1850',
          p25NetEarned: (43000 + idx * 1800).toFixed(2),
          p75NetEarned: (69000 + idx * 2300).toFixed(2),
        },
      }),
    ),
  );
}

async function main() {
  const platformsBySlug = await upsertPlatforms();
  const platforms = [...platformsBySlug.values()];

  const workers = await upsertWorkerUsers();
  const advocates = await upsertRoleUsers(ADVOCATE_PROFILES);
  const verifiers = await upsertRoleUsers(VERIFIER_PROFILES);

  const seedUsers = await db.user.findMany({
    where: {
      email: {
        endsWith: `@${SEED_EMAIL_DOMAIN}`,
      },
    },
    select: {
      id: true,
    },
  });

  await cleanupSeedArtifacts(
    seedUsers.map((user) => user.id),
    workers.map((worker) => worker.id),
  );

  const shiftBlueprints = buildShiftBlueprints(workers, platformsBySlug);
  const seededShiftLogs = await seedShiftLogs(shiftBlueprints);

  const screenshotCount = await seedScreenshots(
    seededShiftLogs,
    verifiers.map((verifier) => verifier.id),
  );

  const anomalyCount = await seedAnomalyFlags(seededShiftLogs);
  const vulnerabilityCount = await seedVulnerabilityFlags(
    seededShiftLogs,
    workers.map((worker) => worker.id),
  );

  const grievanceSummary = await seedGrievances(workers, advocates, platforms);

  const platformNameById = new Map(
    platforms.map((platform) => [platform.id, platform.name] as const),
  );

  const certificateCount = await seedIncomeCertificates(
    workers,
    seededShiftLogs,
    platformNameById,
  );

  const dailyStatCount = await seedDailyPlatformStats(
    workers,
    seededShiftLogs,
  );

  const monthSpread = new Set(
    seededShiftLogs.map((shift) => monthKey(shift.shiftDate)),
  ).size;

  console.log('Seed complete:');
  console.log(`- Seed users ready: ${workers.length + advocates.length + verifiers.length}`);
  console.log(`- Workers: ${workers.length}`);
  console.log(`- Platforms: ${platforms.length}`);
  console.log(`- Shift logs created: ${seededShiftLogs.length}`);
  console.log(`- Weekly window covered: ${TOTAL_WEEKS} weeks`);
  console.log(`- Months represented: ${monthSpread}`);
  console.log(`- Screenshots created: ${screenshotCount}`);
  console.log(`- Anomaly flags created: ${anomalyCount}`);
  console.log(`- Vulnerability flags upserted: ${vulnerabilityCount}`);
  console.log(`- Grievances created: ${grievanceSummary.grievances}`);
  console.log(`- Grievance tags created: ${grievanceSummary.tags}`);
  console.log(`- Grievance escalations created: ${grievanceSummary.escalations}`);
  console.log(`- Income certificates created: ${certificateCount}`);
  console.log(`- Daily platform stats upserted: ${dailyStatCount}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
