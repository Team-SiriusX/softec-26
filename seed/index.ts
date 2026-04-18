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

// cspell:words Bykea Foodpanda Careem inDrive seeduser seedworkers

const SEED_TAG = '[seed-analytics]';
const SEED_EMAIL_DOMAIN = 'seed.fairgig.local';
const SEED_FILE_PREFIX = 'seed/analytics/';

type PlatformSeed = {
  name: string;
  slug: string;
  baseCommission: number;
  incomeBias: number;
};

type ProfileSeed = {
  fullName: string;
  email: string;
  cityZone: string;
  role: Role;
  joinDaysAgo: number;
};

type WorkerProfileSeed = ProfileSeed & {
  category: WorkerCategory;
  baseHourly: number;
  volatility: number;
  primaryPlatforms: string[];
};

type SeedWorker = {
  id: string;
  fullName: string;
  cityZone: string | null;
  category: WorkerCategory | null;
  baseHourly: number;
  volatility: number;
  primaryPlatforms: string[];
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

type ShiftBlueprint = {
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

const PLATFORM_SEEDS: PlatformSeed[] = [
  { name: 'Bykea', slug: 'bykea', baseCommission: 0.24, incomeBias: 0.96 },
  { name: 'Foodpanda', slug: 'foodpanda', baseCommission: 0.26, incomeBias: 1.04 },
  { name: 'Careem', slug: 'careem', baseCommission: 0.2, incomeBias: 1.08 },
  { name: 'Uber', slug: 'uber', baseCommission: 0.22, incomeBias: 1.1 },
  { name: 'inDrive', slug: 'indrive', baseCommission: 0.17, incomeBias: 1.0 },
];

const WORKER_PROFILES: WorkerProfileSeed[] = [
  {
    fullName: 'Aamir Riaz',
    email: `aamir.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Gulberg',
    role: Role.WORKER,
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
    role: Role.WORKER,
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
    role: Role.WORKER,
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
    role: Role.WORKER,
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
    role: Role.WORKER,
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
    role: Role.WORKER,
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
    role: Role.WORKER,
    category: WorkerCategory.RIDE_HAILING,
    baseHourly: 590,
    volatility: 0.14,
    joinDaysAgo: 80,
    primaryPlatforms: ['uber', 'careem', 'indrive'],
  },
  {
    fullName: 'Waqar Ahmed',
    email: `waqar.worker@${SEED_EMAIL_DOMAIN}`,
    cityZone: 'Samanabad',
    role: Role.WORKER,
    category: WorkerCategory.FOOD_DELIVERY,
    baseHourly: 485,
    volatility: 0.2,
    joinDaysAgo: 34,
    primaryPlatforms: ['bykea', 'foodpanda', 'indrive'],
  },
];

const ADVOCATE_PROFILES: ProfileSeed[] = [
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

const VERIFIER_PROFILES: ProfileSeed[] = [
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

function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toUtcDate(next);
}

function startOfUtcWeek(date: Date): Date {
  const day = (date.getUTCDay() + 6) % 7;
  return addUtcDays(toUtcDate(date), -day);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pickPrimaryPlatform(profile: WorkerProfileSeed, seed: number): string {
  const index = Math.floor(randomUnit(seed) * profile.primaryPlatforms.length);
  return profile.primaryPlatforms[index] ?? profile.primaryPlatforms[0];
}

function monthKey(date: Date): string {
  return toIsoDate(startOfUtcMonth(date));
}

function parseMonthKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function seedPlatforms(): Promise<Map<string, SeedPlatform>> {
  const platforms = new Map<string, SeedPlatform>();

  for (const seed of PLATFORM_SEEDS) {
    const platform = await db.platform.upsert({
      where: { slug: seed.slug },
      update: { name: seed.name },
      create: {
        name: seed.name,
        slug: seed.slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    platforms.set(seed.slug, {
      id: platform.id,
      name: platform.name,
      slug: platform.slug,
      baseCommission: seed.baseCommission,
      incomeBias: seed.incomeBias,
    });
  }

  return platforms;
}

async function seedUsers(profiles: ProfileSeed[]): Promise<SeedUser[]> {
  const today = toUtcDate(new Date());
  const users: SeedUser[] = [];

  for (const profile of profiles) {
    const user = await db.user.upsert({
      where: { email: profile.email },
      update: {
        fullName: profile.fullName,
        role: profile.role,
        cityZone: profile.cityZone,
        isActive: true,
      },
      create: {
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        cityZone: profile.cityZone,
        isActive: true,
        createdAt: addUtcDays(today, -profile.joinDaysAgo),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    users.push(user);
  }

  return users;
}

async function cleanupSeedArtifacts(seedUserIds: string[]): Promise<void> {
  await db.grievanceTag.deleteMany({
    where: {
      tag: {
        startsWith: 'seed-',
      },
    },
  });

  await db.grievanceEscalation.deleteMany({
    where: {
      note: {
        contains: SEED_TAG,
      },
    },
  });

  await db.grievance.deleteMany({
    where: {
      OR: [
        {
          title: {
            startsWith: SEED_TAG,
          },
        },
        {
          clusterId: {
            startsWith: 'seed-cluster-',
          },
        },
      ],
    },
  });

  await db.screenshot.deleteMany({
    where: {
      fileKey: {
        startsWith: SEED_FILE_PREFIX,
      },
    },
  });

  await db.anomalyFlag.deleteMany({
    where: {
      flagType: {
        startsWith: 'seed_',
      },
    },
  });

  await db.vulnerabilityFlag.deleteMany({
    where: {
      workerId: {
        in: seedUserIds,
      },
    },
  });

  await db.incomeCertificate.deleteMany({
    where: {
      OR: [
        {
          htmlSnapshot: {
            contains: 'seed-certificate',
          },
        },
        {
          workerId: {
            in: seedUserIds,
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
): ShiftBlueprint[] {
  const today = toUtcDate(new Date());
  const currentWeekStart = startOfUtcWeek(today);
  const rows: ShiftBlueprint[] = [];
  const dayPattern = [0, 1, 3, 5, 6] as const;

  for (const [workerIndex, worker] of workers.entries()) {
    for (let weekOffset = 23; weekOffset >= 0; weekOffset -= 1) {
      const weekStart = addUtcDays(currentWeekStart, -weekOffset * 7);
      const shiftsThisWeek = 3 + ((workerIndex + weekOffset) % 2);
      const seasonalWave = 1 + Math.sin((weekOffset + workerIndex) / 3.2) * 0.08;
      const stressPeriod = weekOffset >= 8 && weekOffset <= 11 ? 0.85 : 1;

      for (let shiftIndex = 0; shiftIndex < shiftsThisWeek; shiftIndex += 1) {
        const shiftDate = addUtcDays(weekStart, dayPattern[shiftIndex] ?? 6);

        if (shiftDate > today) {
          continue;
        }

        const randomSeed = workerIndex * 100_000 + weekOffset * 100 + shiftIndex;
        const platformSlug =
          randomUnit(randomSeed + 7) > 0.85
            ? PLATFORM_SEEDS[(workerIndex + weekOffset + shiftIndex) % PLATFORM_SEEDS.length]
                .slug
            : pickPrimaryPlatform(worker, randomSeed);

        const platform = platformsBySlug.get(platformSlug);

        if (!platform) {
          continue;
        }

        const hoursWorked = clamp(5 + randomUnit(randomSeed + 11) * 5.5, 4, 12);
        const workerNoise = 1 + (randomUnit(randomSeed + 19) - 0.5) * Math.max(worker.volatility, 0.04);
        const marketNoise = 0.92 + randomUnit(randomSeed + 23) * 0.18;
        const grossEarned = Math.max(
          900,
          hoursWorked * worker.baseHourly * platform.incomeBias * seasonalWave * stressPeriod * workerNoise * marketNoise,
        );
        const commissionRate = clamp(
          platform.baseCommission + (randomUnit(randomSeed + 29) - 0.5) * 0.05,
          0.12,
          0.38,
        );
        const platformDeductions = grossEarned * commissionRate;
        const netReceived = grossEarned - platformDeductions;
        const verificationRoll = randomUnit(randomSeed + 31);
        let verificationStatus = VerificationStatus.CONFIRMED;

        if (verificationRoll > 0.93) {
          verificationStatus = VerificationStatus.PENDING;
        }

        if (verificationRoll > 0.98) {
          verificationStatus = VerificationStatus.FLAGGED;
        }

        if (verificationRoll < 0.02) {
          verificationStatus = VerificationStatus.UNVERIFIABLE;
        }

        rows.push({
          workerId: worker.id,
          platformId: platform.id,
          shiftDate,
          hoursWorked,
          grossEarned,
          platformDeductions,
          netReceived,
          verificationStatus,
          importedViaCsv: randomUnit(randomSeed + 37) > 0.82,
          notes: `${SEED_TAG} worker=${worker.id} week=${weekOffset} shift=${shiftIndex}`,
        });
      }
    }
  }

  return rows;
}

async function seedShiftLogs(rows: ShiftBlueprint[]): Promise<SeedShiftRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  await db.shiftLog.createMany({
    data: rows.map((row) => ({
      workerId: row.workerId,
      platformId: row.platformId,
      shiftDate: row.shiftDate,
      hoursWorked: row.hoursWorked.toFixed(2),
      grossEarned: row.grossEarned.toFixed(2),
      platformDeductions: row.platformDeductions.toFixed(2),
      netReceived: row.netReceived.toFixed(2),
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
  if (verifierIds.length === 0) {
    return 0;
  }

  const rows = shiftLogs
    .filter((_, index) => index % 7 === 0)
    .map((log, index) => {
      const status =
        index % 4 === 0
          ? ScreenshotStatus.PENDING
          : index % 4 === 1
            ? ScreenshotStatus.CONFIRMED
            : index % 4 === 2
              ? ScreenshotStatus.FLAGGED
              : ScreenshotStatus.UNVERIFIABLE;

      return {
        shiftLogId: log.id,
        verifierId: verifierIds[index % verifierIds.length],
        fileUrl: `https://cdn.example.org/${SEED_FILE_PREFIX}screenshot-${index + 1}.png`,
        fileKey: `${SEED_FILE_PREFIX}screenshot-${index + 1}.png`,
        status,
        verifierNotes:
          status === ScreenshotStatus.CONFIRMED
            ? `${SEED_TAG} Verified evidence.`
            : status === ScreenshotStatus.PENDING
              ? `${SEED_TAG} Awaiting review.`
              : `${SEED_TAG} Requires manual verification.`,
        reviewedAt: status === ScreenshotStatus.PENDING ? null : addUtcDays(log.shiftDate, 1),
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

      return {
        workerId: log.workerId,
        shiftLogId: log.id,
        flagType: severe ? 'seed_commission_spike' : 'seed_income_drop',
        severity: severe ? 'high' : deductionRate >= 0.27 ? 'medium' : 'low',
        explanation: `${SEED_TAG} Commission and payout pattern diverged from recent baseline.`,
        zScore: (1.1 + deductionRate * 6 + randomUnit(index + 41)).toFixed(4),
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
    const months = [...monthMap.keys()].sort();

    for (let index = 1; index < months.length; index += 1) {
      const prevMonthKey = months[index - 1];
      const currMonthKey = months[index];
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
            flagMonth: parseMonthKey(currMonthKey),
          },
        },
        update: {
          prevMonthNet: prevMonthNet.toFixed(2),
          currMonthNet: currMonthNet.toFixed(2),
          dropPct: dropPct.toFixed(4),
          resolved: false,
        },
        create: {
          workerId,
          flagMonth: parseMonthKey(currMonthKey),
          prevMonthNet: prevMonthNet.toFixed(2),
          currMonthNet: currMonthNet.toFixed(2),
          dropPct: dropPct.toFixed(4),
          resolved: false,
        },
      });

      total += 1;
    }

    if (months.length >= 2 && total === 0) {
      const latestMonthKey = months[months.length - 1];
      const previousMonthKey = months[months.length - 2];
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
            prevMonthNet: prevMonthNet.toFixed(2),
            currMonthNet: syntheticCurr.toFixed(2),
            dropPct: '0.2200',
            resolved: false,
          },
          create: {
            workerId,
            flagMonth: parseMonthKey(latestMonthKey),
            prevMonthNet: prevMonthNet.toFixed(2),
            currMonthNet: syntheticCurr.toFixed(2),
            dropPct: '0.2200',
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
): Promise<{ grievances: number; tags: number; escalations: number }> {
  const fallbackAdvocate = advocates[0]?.id ?? workers[0]?.id;

  if (!fallbackAdvocate) {
    return { grievances: 0, tags: 0, escalations: 0 };
  }

  const created: Array<{ id: string; category: string }> = [];
  const currentWeekStart = startOfUtcWeek(toUtcDate(new Date()));

  for (let weekOffset = 12; weekOffset >= 0; weekOffset -= 1) {
    const weekStart = addUtcDays(currentWeekStart, -weekOffset * 7);
    const issuesThisWeek = 2 + (weekOffset % 3);

    for (let issueIndex = 0; issueIndex < issuesThisWeek; issueIndex += 1) {
      const worker = workers[(weekOffset + issueIndex) % workers.length];
      const platform = platforms[(weekOffset * 2 + issueIndex) % platforms.length];
      const category = GRIEVANCE_CATEGORIES[(weekOffset + issueIndex) % GRIEVANCE_CATEGORIES.length];
      const status =
        weekOffset % 5 === 0
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
          description: `${SEED_TAG} ${worker.cityZone ?? 'Unknown'} workers reported ${category.toLowerCase().replaceAll('_', ' ')} on ${platform.name}.`,
          status,
          isAnonymous: issueIndex % 4 === 0,
          clusterId: `seed-cluster-${category.toLowerCase()}`,
          createdAt: addUtcDays(weekStart, (issueIndex * 2) % 6),
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

async function seedIncomeCertificates(
  workers: SeedWorker[],
  shiftLogs: SeedShiftRecord[],
  platformNameById: Map<string, string>,
): Promise<number> {
  const rows = workers.slice(0, 5).map((worker, index) => {
    const workerLogs = shiftLogs.filter((shift) => shift.workerId === worker.id);
    const totalVerified = workerLogs.reduce((sum, shift) => sum + toNumber(shift.netReceived), 0);
    const platformNames = [
      ...new Set(workerLogs.map((shift) => platformNameById.get(shift.platformId)).filter(Boolean)),
    ] as string[];

    const endDate = toUtcDate(new Date());
    const startDate = addUtcDays(endDate, -60 - index * 7);

    return {
      workerId: worker.id,
      fromDate: startDate,
      toDate: addUtcDays(endDate, -1),
      totalVerified: totalVerified.toFixed(2),
      shiftCount: workerLogs.length,
      platformsList: platformNames.length > 0 ? platformNames : ['Bykea'],
      htmlSnapshot: `<html><body><h1>Income Certificate</h1><p>seed-certificate-${index + 1}</p></body></html>`,
      status: CertificateStatus.GENERATED,
      expiresAt: addUtcDays(endDate, 90),
    };
  });

  if (rows.length > 0) {
    await db.incomeCertificate.createMany({ data: rows });
  }

  return rows.length;
}

async function seedDailyStats(
  workers: SeedWorker[],
  shiftLogs: SeedShiftRecord[],
  platforms: SeedPlatform[],
): Promise<number> {
  const statDate = startOfUtcMonth(toUtcDate(new Date()));
  const platformsById = new Map(platforms.map((platform) => [platform.id, platform] as const));
  const workersById = new Map(workers.map((worker) => [worker.id, worker] as const));
  const statsByKey = new Map<
    string,
    {
      platformId: string;
      cityZone: string;
      category: WorkerCategory;
      workerIds: Set<string>;
      netValues: number[];
      deductions: number[];
    }
  >();

  for (const shift of shiftLogs) {
    const worker = workersById.get(shift.workerId);
    const platform = platformsById.get(shift.platformId);

    if (!worker || !platform || !worker.cityZone || !worker.category) {
      continue;
    }

    const key = `${platform.id}:${worker.cityZone}:${worker.category}`;
    const entry = statsByKey.get(key) ?? {
      platformId: platform.id,
      cityZone: worker.cityZone,
      category: worker.category,
      workerIds: new Set<string>(),
      netValues: [],
      deductions: [],
    };

    entry.workerIds.add(worker.id);
    entry.netValues.push(toNumber(shift.netReceived));
    entry.deductions.push(toNumber(shift.platformDeductions) / Math.max(1, toNumber(shift.grossEarned)));
    statsByKey.set(key, entry);
  }

  const rows = [...statsByKey.values()].map((entry) => {
    const sorted = [...entry.netValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianNetEarned =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

    const p25Index = Math.max(0, Math.floor((sorted.length - 1) * 0.25));
    const p75Index = Math.max(0, Math.floor((sorted.length - 1) * 0.75));
    const avgCommissionPct =
      entry.deductions.length === 0
        ? 0
        : entry.deductions.reduce((sum, value) => sum + value, 0) / entry.deductions.length;

    return {
      platformId: entry.platformId,
      cityZone: entry.cityZone,
      category: entry.category,
      statDate,
      workerCount: entry.workerIds.size,
      medianNetEarned: medianNetEarned.toFixed(2),
      avgCommissionPct: avgCommissionPct.toFixed(4),
      p25NetEarned: (sorted[p25Index] ?? medianNetEarned).toFixed(2),
      p75NetEarned: (sorted[p75Index] ?? medianNetEarned).toFixed(2),
    };
  });

  for (const row of rows) {
    await db.dailyPlatformStat.upsert({
      where: {
        platformId_cityZone_category_statDate: {
          platformId: row.platformId,
          cityZone: row.cityZone,
          category: row.category,
          statDate: row.statDate,
        },
      },
      update: {
        workerCount: row.workerCount,
        medianNetEarned: row.medianNetEarned,
        avgCommissionPct: row.avgCommissionPct,
        p25NetEarned: row.p25NetEarned,
        p75NetEarned: row.p75NetEarned,
      },
      create: row,
    });
  }

  return rows.length;
}

async function main() {
  const platformsBySlug = await seedPlatforms();
  const platforms = [...platformsBySlug.values()];

  const workers = await seedUsers(WORKER_PROFILES);
  const advocates = await seedUsers(ADVOCATE_PROFILES);
  const verifiers = await seedUsers(VERIFIER_PROFILES);

  const seedUserIds = [...workers, ...advocates, ...verifiers].map((user) => user.id);
  await cleanupSeedArtifacts(seedUserIds);

  const shiftBlueprints = buildShiftBlueprints(workers, platformsBySlug);
  const shiftLogs = await seedShiftLogs(shiftBlueprints);

  const screenshotCount = await seedScreenshots(
    shiftLogs,
    verifiers.map((verifier) => verifier.id),
  );
  const anomalyCount = await seedAnomalyFlags(shiftLogs);
  const vulnerabilityCount = await seedVulnerabilityFlags(
    shiftLogs,
    workers.map((worker) => worker.id),
  );
  const grievanceSummary = await seedGrievances(workers, advocates, platforms);
  const certificateCount = await seedIncomeCertificates(
    workers,
    shiftLogs,
    new Map(platforms.map((platform) => [platform.id, platform.name] as const)),
  );
  const dailyStatCount = await seedDailyStats(workers, shiftLogs, platforms);

  console.log('Seed complete:');
  console.log(`- Workers: ${workers.length}`);
  console.log(`- Advocates: ${advocates.length}`);
  console.log(`- Verifiers: ${verifiers.length}`);
  console.log(`- Platforms: ${platforms.length}`);
  console.log(`- Shift logs created: ${shiftLogs.length}`);
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
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });