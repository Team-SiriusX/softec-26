import 'dotenv/config';
import {
  CertificateStatus,
  GrievanceCategory,
  GrievanceStatus,
  ScreenshotStatus,
  VerificationStatus,
  WorkerCategory,
} from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';
import db from '@/lib/db';

// cspell:words Bykea bykea Foodpanda foodpanda Careem careem upserted Indriver indriver Upserts

type SeedContext = {
  userIds: string[];
  verifierIds: string[];
  advocateIds: string[];
};

async function getSeedContext(): Promise<SeedContext> {
  const users = await db.user.findMany({
    where: { role: 'WORKER' },
    select: { id: true },
    take: 12,
    orderBy: { createdAt: 'asc' },
  });

  const verifiers = await db.user.findMany({
    where: { role: 'VERIFIER' },
    select: { id: true },
    take: 3,
  });

  const advocates = await db.user.findMany({
    where: { role: 'ADVOCATE' },
    select: { id: true },
    take: 2,
  });

  const userIds = users.map((user) => user.id);
  const verifierIds = verifiers.map((v) => v.id);
  const advocateIds = advocates.map((a) => a.id);

  return { userIds, verifierIds, advocateIds };
}

function getIsoDateOffset(daysOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date;
}

async function seedPlatforms() {
  const platforms = [
    { name: 'Bykea', slug: 'bykea' },
    { name: 'Foodpanda', slug: 'foodpanda' },
    { name: 'Careem', slug: 'careem' },
    { name: 'Uber', slug: 'uber' },
    { name: 'Indriver', slug: 'indriver' },
  ];

  const platformUpserts = platforms.map((platform) =>
    db.platform.upsert({
      where: { slug: platform.slug },
      update: { name: platform.name },
      create: platform,
    }),
  );

  return Promise.all(platformUpserts);
}

async function seedShiftLogs(userIds: string[], platformIds: string[]) {
  await db.shiftLog.deleteMany({
    where: {
      notes: {
        contains: '[seed]',
      },
    },
  });

  const rows = userIds.flatMap((workerId, userIdx) => {
    // Each worker gets 10-15 shifts over the last 30 days
    const shiftCount = 10 + (userIdx % 6);
    return Array.from({ length: shiftCount }).map((_, slot) => {
      const baseEarned = 1500 + (userIdx % 5) * 300;
      const randomVol = Math.random() * 800;
      const grossEarned = baseEarned + randomVol;

      // Variable commission rates
      const commissionRate = 0.15 + (slot % 10) * 0.02;
      const platformDeductions = Math.round(grossEarned * commissionRate);
      const netReceived = grossEarned - platformDeductions;

      // Some status variety
      const statuses = [
        VerificationStatus.CONFIRMED,
        VerificationStatus.CONFIRMED,
        VerificationStatus.PENDING,
        VerificationStatus.FLAGGED,
        VerificationStatus.UNVERIFIABLE,
      ];

      return {
        workerId,
        platformId: platformIds[(userIdx + slot) % platformIds.length],
        shiftDate: getIsoDateOffset(-slot - 1),
        hoursWorked: (6 + (slot % 4)).toFixed(2),
        grossEarned: grossEarned.toFixed(2),
        platformDeductions: platformDeductions.toFixed(2),
        netReceived: netReceived.toFixed(2),
        verificationStatus: statuses[slot % statuses.length],
        importedViaCsv: slot % 3 === 0,
        notes: `[seed] Shift ${slot + 1} for worker ${workerId}. Automated entry.`,
      };
    });
  });

  await db.shiftLog.createMany({ data: rows });

  return db.shiftLog.findMany({
    where: {
      notes: {
        contains: '[seed]',
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function seedScreenshots(
  shiftLogs: Array<{ id: string }>,
  verifierIds: string[],
) {
  if (verifierIds.length === 0) return;

  await db.screenshot.deleteMany({
    where: {
      fileKey: {
        startsWith: 'seed/',
      },
    },
  });

  const screenshotRows = shiftLogs
    .slice(0, Math.min(shiftLogs.length, 100))
    .map((log, idx) => ({
      shiftLogId: log.id,
      verifierId: verifierIds[idx % verifierIds.length],
      fileUrl: `https://cdn.example.org/seed/screenshot-${(idx % 20) + 1}.png`,
      fileKey: `seed/screenshot-${(idx % 20) + 1}.png`,
      status:
        idx % 4 === 0 ? ScreenshotStatus.PENDING : ScreenshotStatus.CONFIRMED,
      verifierNotes:
        idx % 4 === 0
          ? '[seed] Awaiting verification.'
          : '[seed] Matches system records.',
      reviewedAt: idx % 4 !== 0 ? getIsoDateOffset(-idx % 5) : null,
    }));

  await db.screenshot.createMany({ data: screenshotRows });
}

async function seedAnomalyFlags(
  shiftLogs: Array<{
    id: string;
    workerId: string;
    grossEarned: Prisma.Decimal;
    platformDeductions: Prisma.Decimal;
  }>,
  userIds: string[],
) {
  await db.anomalyFlag.deleteMany({
    where: {
      flagType: {
        startsWith: 'seed_',
      },
    },
  });

  // Generate anomalies for about 20% of shift logs
  const anomalyRows = shiftLogs
    .filter((_, idx) => idx % 5 === 0)
    .map((log, idx) => {
      const types = [
        'seed_income_drop',
        'seed_unusual_deduction',
        'seed_high_commission',
        'seed_irregular_hours',
      ];
      const severities = ['low', 'medium', 'high'];

      return {
        workerId: log.workerId,
        shiftLogId: log.id,
        flagType: types[idx % types.length],
        severity: severities[idx % severities.length],
        explanation: `[seed] Alert: Detected ${types[idx % types.length].replace('seed_', '').replace('_', ' ')} for this shift.`,
        zScore: (1.5 + (idx % 10) * 0.3).toFixed(4),
      };
    });

  await db.anomalyFlag.createMany({ data: anomalyRows });

  // Vulnerability flags for some workers
  await Promise.all(
    userIds.slice(0, 5).map((workerId, idx) =>
      db.vulnerabilityFlag.upsert({
        where: {
          workerId_flagMonth: {
            workerId,
            flagMonth: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1,
            ),
          },
        },
        update: {
          prevMonthNet: (60000 + idx * 2000).toFixed(2),
          currMonthNet: (40000 + idx * 1000).toFixed(2),
          dropPct: '0.3300',
          resolved: idx % 2 === 0,
        },
        create: {
          workerId,
          flagMonth: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
          prevMonthNet: (60000 + idx * 2000).toFixed(2),
          currMonthNet: (40000 + idx * 1000).toFixed(2),
          dropPct: '0.3300',
          resolved: idx % 2 === 0,
        },
      }),
    ),
  );
}

async function seedGrievances(
  userIds: string[],
  platformIds: string[],
  advocateIds: string[],
) {
  if (advocateIds.length === 0) return;

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
        contains: '[seed]',
      },
    },
  });

  await db.grievance.deleteMany({
    where: {
      title: {
        startsWith: '[seed]',
      },
    },
  });

  const categories = [
    GrievanceCategory.PAYMENT_DISPUTE,
    GrievanceCategory.COMMISSION_CHANGE,
    GrievanceCategory.ACCOUNT_DEACTIVATION,
    GrievanceCategory.SAFETY_CONCERN,
    GrievanceCategory.UNFAIR_RATING,
  ];

  const grievanceData = userIds.slice(0, 8).map((workerId, idx) => ({
    workerId,
    platformId: platformIds[idx % platformIds.length],
    category: categories[idx % categories.length],
    title: `[seed] Complaint regarding ${categories[idx % categories.length].toLowerCase().replace('_', ' ')}`,
    description: `[seed] This is a detailed description of the worker grievance regarding ${categories[idx % categories.length]}. The worker claims systemic issues.`,
    status:
      idx % 3 === 0
        ? GrievanceStatus.RESOLVED
        : idx % 2 === 0
          ? GrievanceStatus.OPEN
          : GrievanceStatus.TAGGED,
    isAnonymous: idx % 4 === 0,
    clusterId: idx % 2 === 0 ? `seed-cluster-A` : `seed-cluster-B`,
    idx,
  }));

  for (const data of grievanceData) {
    const { idx, ...createData } = data;
    const grievance = await db.grievance.create({ data: createData });

    // Add tags if status is not OPEN
    if (grievance.status !== GrievanceStatus.OPEN) {
      await db.grievanceTag.create({
        data: {
          grievanceId: grievance.id,
          advocateId: advocateIds[0],
          tag: idx % 2 === 0 ? 'seed-urgent' : 'seed-follow-up',
        },
      });
    }

    // Add escalation if status is TAGGED
    if (grievance.status === GrievanceStatus.TAGGED) {
      await db.grievanceEscalation.create({
        data: {
          grievanceId: grievance.id,
          advocateId: advocateIds[idx % advocateIds.length],
          note: `[seed] Escalating to platform representative due to lack of response.`,
        },
      });
    }
  }
}

async function seedIncomeCertificates(
  userIds: string[],
  platformNames: string[],
) {
  await db.incomeCertificate.deleteMany({
    where: {
      htmlSnapshot: {
        contains: 'seed-certificate',
      },
    },
  });

  await db.incomeCertificate.createMany({
    data: userIds.slice(0, 5).map((workerId, idx) => ({
      workerId,
      fromDate: getIsoDateOffset(-60),
      toDate: getIsoDateOffset(-1),
      totalVerified: (85000 + idx * 5000).toFixed(2),
      shiftCount: 45 + idx,
      platformsList: platformNames.slice(0, 2),
      htmlSnapshot: `<html><body><h1>Income Certificate</h1><p>Seed-certificate-UUID-${idx}</p></body></html>`,
      status: CertificateStatus.GENERATED,
      expiresAt: getIsoDateOffset(90),
    })),
  });
}

async function seedDailyStats(platformIds: string[]) {
  const cities = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad'];
  const categories = [
    WorkerCategory.FOOD_DELIVERY,
    WorkerCategory.RIDE_HAILING,
  ];

  const stats = [];

  for (const platformId of platformIds) {
    for (const city of cities) {
      for (const category of categories) {
        // Create stats for last 3 months
        for (let i = 0; i < 3; i++) {
          const idx = i;
          const date = new Date();
          date.setMonth(date.getMonth() - idx);
          date.setDate(1);

          stats.push({
            platformId,
            cityZone: city,
            category,
            statDate: date,
            workerCount: 50 + Math.floor(Math.random() * 500),
            medianNetEarned: (45000 + Math.random() * 20000).toFixed(2),
            avgCommissionPct: (0.15 + Math.random() * 0.1).toFixed(4),
            p25NetEarned: (35000 + Math.random() * 10000).toFixed(2),
            p75NetEarned: (65000 + Math.random() * 15000).toFixed(2),
          });
        }
      }
    }
  }

  // Use upsert pattern to avoid duplicates if re-run
  await Promise.all(
    stats.map((stat) =>
      db.dailyPlatformStat.upsert({
        where: {
          platformId_cityZone_category_statDate: {
            platformId: stat.platformId,
            cityZone: stat.cityZone,
            category: stat.category,
            statDate: stat.statDate,
          },
        },
        update: stat,
        create: stat,
      }),
    ),
  );
}

async function main() {
  console.log('Starting seed...');
  const { userIds, verifierIds, advocateIds } = await getSeedContext();

  if (userIds.length === 0) {
    console.error(
      'No workers found in database. Please run auth seed or create users first.',
    );
    return;
  }

  const platforms = await seedPlatforms();
  const platformIds = platforms.map((platform) => platform.id);
  const platformNames = platforms.map((platform) => platform.name);

  const shiftLogs = await seedShiftLogs(userIds, platformIds);
  console.log(`- Created ${shiftLogs.length} shift logs`);

  await seedScreenshots(shiftLogs, verifierIds);
  console.log(`- Created screenshots`);

  await seedAnomalyFlags(shiftLogs, userIds);
  console.log(`- Created anomaly flags`);

  await seedGrievances(userIds, platformIds, advocateIds);
  console.log(`- Created grievances and tags`);

  await seedIncomeCertificates(userIds, platformNames);
  console.log(`- Created income certificates`);

  await seedDailyStats(platformIds);
  console.log(`- Updated daily platform stats`);

  console.log('Seed complete:');
  console.log(`- Workers referenced: ${userIds.length}`);
  console.log(`- Verifiers referenced: ${verifierIds.length}`);
  console.log(`- Advocates referenced: ${advocateIds.length}`);
  console.log(`- Platforms upserted: ${platformIds.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
