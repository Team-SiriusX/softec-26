import 'dotenv/config';
import {
  CertificateStatus,
  GrievanceCategory,
  GrievanceStatus,
  ScreenshotStatus,
  VerificationStatus,
  WorkerCategory,
} from '@/generated/prisma/enums';
import db from '@/lib/db';

// cspell:words Bykea bykea Foodpanda foodpanda Careem careem upserted

type SeedContext = {
  userIds: string[];
};

async function getSeedContext(): Promise<SeedContext> {
  const users = await db.user.findMany({
    select: { id: true },
    take: 8,
    orderBy: { createdAt: 'asc' },
  });

  const userIds = users.map((user) => user.id);

  if (userIds.length < 3) {
    throw new Error(
      'Seed requires at least 3 existing users. Create users first, then run pnpm seed.',
    );
  }

  return { userIds };
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
          slot % 2 === 0
            ? VerificationStatus.CONFIRMED
            : VerificationStatus.PENDING,
        importedViaCsv: slot % 2 === 0,
        notes: `[seed] Shift ${slot + 1} for worker ${workerId}`,
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
  userIds: string[],
) {
  await db.screenshot.deleteMany({
    where: {
      fileKey: {
        startsWith: 'seed/',
      },
    },
  });

  const screenshotRows = shiftLogs
    .slice(0, Math.min(shiftLogs.length, 8))
    .map((log, idx) => ({
      shiftLogId: log.id,
      verifierId: userIds[(idx + 1) % userIds.length],
      fileUrl: `https://cdn.example.org/seed/screenshot-${idx + 1}.png`,
      fileKey: `seed/screenshot-${idx + 1}.png`,
      status:
        idx % 2 === 0 ? ScreenshotStatus.CONFIRMED : ScreenshotStatus.PENDING,
      verifierNotes:
        idx % 2 === 0 ? '[seed] Looks valid.' : '[seed] Pending review.',
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

  const seenWorkerIds = new Set<string>();
  const anomalyRows = shiftLogs
    .filter((log) => {
      if (seenWorkerIds.has(log.workerId)) return false;
      seenWorkerIds.add(log.workerId);
      return true;
    })
    .map((log, idx) => ({
      workerId: log.workerId,
      shiftLogId: log.id,
      flagType: idx % 2 === 0 ? 'seed_income_drop' : 'seed_unusual_deduction',
      severity: idx % 3 === 0 ? 'high' : 'medium',
      explanation: '[seed] Auto-generated anomaly for dashboard testing.',
      zScore: (1.25 + idx * 0.2).toFixed(4),
    }));

  await db.anomalyFlag.createMany({ data: anomalyRows });

  await Promise.all(
    userIds.map((workerId, idx) =>
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
          prevMonthNet: (54000 + idx * 1400).toFixed(2),
          currMonthNet: (42000 + idx * 1200).toFixed(2),
          dropPct: '0.2200',
          resolved: false,
        },
        create: {
          workerId,
          flagMonth: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
          prevMonthNet: (54000 + idx * 1400).toFixed(2),
          currMonthNet: (42000 + idx * 1200).toFixed(2),
          dropPct: '0.2200',
          resolved: false,
        },
      }),
    ),
  );
}

async function seedGrievances(userIds: string[], platformIds: string[]) {
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

  const grievances = await Promise.all(
    userIds.map((workerId, idx) =>
      db.grievance.create({
        data: {
          workerId,
          platformId: platformIds[idx % platformIds.length],
          category:
            idx % 2 === 0
              ? GrievanceCategory.PAYMENT_DISPUTE
              : GrievanceCategory.COMMISSION_CHANGE,
          title: `[seed] Grievance ${idx + 1}`,
          description:
            '[seed] Worker reported discrepancy between gross earnings and payout.',
          status: idx % 2 === 0 ? GrievanceStatus.OPEN : GrievanceStatus.TAGGED,
          isAnonymous: false,
          clusterId: `seed-cluster-${(idx % 2) + 1}`,
        },
      }),
    ),
  );

  await db.grievanceTag.createMany({
    data: grievances.map((grievance, idx) => ({
      grievanceId: grievance.id,
      advocateId: userIds[(idx + 1) % userIds.length],
      tag: idx % 2 === 0 ? 'seed-payment-gap' : 'seed-commission-spike',
    })),
  });

  await db.grievanceEscalation.createMany({
    data: grievances.map((grievance, idx) => ({
      grievanceId: grievance.id,
      advocateId: userIds[(idx + 2) % userIds.length],
      note: `[seed] Escalated for manual review ${idx + 1}.`,
    })),
  });
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
    data: userIds.map((workerId, idx) => ({
      workerId,
      fromDate: getIsoDateOffset(-30),
      toDate: getIsoDateOffset(-1),
      totalVerified: (38000 + idx * 1500).toFixed(2),
      shiftCount: 12 + idx,
      platformsList: platformNames,
      htmlSnapshot: `<html><body>seed-certificate-${idx + 1}</body></html>`,
      status: CertificateStatus.GENERATED,
      expiresAt: getIsoDateOffset(45),
    })),
  });
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
            statDate: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1,
            ),
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
          statDate: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
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
  const { userIds } = await getSeedContext();

  const platforms = await seedPlatforms();
  const platformIds = platforms.map((platform) => platform.id);
  const platformNames = platforms.map((platform) => platform.name);

  const shiftLogs = await seedShiftLogs(userIds, platformIds);
  await seedScreenshots(shiftLogs, userIds);
  await seedAnomalyFlags(shiftLogs, userIds);
  await seedGrievances(userIds, platformIds);
  await seedIncomeCertificates(userIds, platformNames);
  await seedDailyStats(platformIds);

  console.log('Seed complete:');
  console.log(`- Users referenced: ${userIds.length}`);
  console.log(`- Platforms upserted: ${platformIds.length}`);
  console.log(`- Shift logs created: ${shiftLogs.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
