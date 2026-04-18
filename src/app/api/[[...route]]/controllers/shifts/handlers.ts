import db from '@/lib/db';
import { Context } from 'hono';

// ─── GET /api/shifts ─────────────────────────────────────────────────────────
export const getShiftsHandler = async (c: Context) => {
  const user = c.var.user as { id: string; role: string } | undefined;
  const workerId = user?.id;

  if (!workerId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const status = c.req.query('status');
  const platform = c.req.query('platform');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const shifts = await db.shiftLog.findMany({
    where: {
      workerId,
      ...(status && { verificationStatus: status as 'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE' }),
      ...(platform && { platform: { name: platform } }),
      ...(from || to
        ? {
            shiftDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      platform: true,
      screenshot: { select: { status: true, fileUrl: true, verifierNotes: true } },
    },
    orderBy: { shiftDate: 'desc' },
    take: 200,
  });

  const enriched = shifts.map((s) => ({
    ...s,
    effectiveHourlyRate:
      Number(s.hoursWorked) > 0
        ? Number(s.netReceived) / Number(s.hoursWorked)
        : 0,
    deductionRatePct:
      Number(s.grossEarned) > 0
        ? (Number(s.platformDeductions) / Number(s.grossEarned)) * 100
        : 0,
  }));

  return c.json({ data: enriched });
};

// ─── GET /api/shifts/:id ─────────────────────────────────────────────────────
export const getShiftByIdHandler = async (c: Context) => {
  const user = c.var.user as { id: string } | undefined;
  const workerId = user?.id;
  if (!workerId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const shift = await db.shiftLog.findFirst({
    where: { id, workerId },
    include: {
      platform: true,
      screenshot: {
        select: { status: true, fileUrl: true, verifierNotes: true, uploadedAt: true },
      },
    },
  });

  if (!shift) return c.json({ error: 'Not found' }, 404);

  return c.json({
    data: {
      ...shift,
      effectiveHourlyRate:
        Number(shift.hoursWorked) > 0
          ? Number(shift.netReceived) / Number(shift.hoursWorked)
          : 0,
      deductionRatePct:
        Number(shift.grossEarned) > 0
          ? (Number(shift.platformDeductions) / Number(shift.grossEarned)) * 100
          : 0,
    },
  });
};

// ─── POST /api/shifts ────────────────────────────────────────────────────────
export const createShiftHandler = async (c: Context) => {
  const user = c.var.user as { id: string } | undefined;
  const workerId = user?.id;
  if (!workerId) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{
    platform: string;
    shiftDate: string;
    hoursWorked: number;
    grossEarned: number;
    platformDeductions: number;
    netReceived: number;
    notes?: string;
  }>();

  // Upsert platform by name (free text, no fixed list)
  const platformRecord = await db.platform.upsert({
    where: { name: body.platform },
    create: {
      name: body.platform,
      slug: body.platform.toLowerCase().replace(/\s+/g, '-'),
    },
    update: {},
  });

  const shift = await db.shiftLog.create({
    data: {
      workerId,
      platformId: platformRecord.id,
      shiftDate: new Date(body.shiftDate),
      hoursWorked: body.hoursWorked,
      grossEarned: body.grossEarned,
      platformDeductions: body.platformDeductions,
      netReceived: body.netReceived,
      notes: body.notes,
      verificationStatus: 'PENDING',
    },
    include: { platform: true },
  });

  return c.json(
    {
      data: {
        ...shift,
        effectiveHourlyRate:
          Number(shift.hoursWorked) > 0
            ? Number(shift.netReceived) / Number(shift.hoursWorked)
            : 0,
        deductionRatePct:
          Number(shift.grossEarned) > 0
            ? (Number(shift.platformDeductions) / Number(shift.grossEarned)) * 100
            : 0,
      },
    },
    201,
  );
};

// ─── POST /api/shifts/import ─────────────────────────────────────────────────
type CsvRow = {
  platform?: string;
  date?: string;
  hours_worked?: string | number;
  gross_earned?: string | number;
  platform_deductions?: string | number;
  net_received?: string | number;
};

export const importCsvHandler = async (c: Context) => {
  const user = c.var.user as { id: string } | undefined;
  const workerId = user?.id;
  if (!workerId) return c.json({ error: 'Unauthorized' }, 401);

  const { rows } = await c.req.json<{ rows: CsvRow[] }>();

  const created: string[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Validate
    if (!row.platform) {
      errors.push({ row: rowNum, message: 'platform is required' });
      continue;
    }
    if (!row.date) {
      errors.push({ row: rowNum, message: 'date is required' });
      continue;
    }
    const hoursWorked = Number(row.hours_worked);
    if (isNaN(hoursWorked) || hoursWorked < 0.5 || hoursWorked > 24) {
      errors.push({ row: rowNum, message: 'hours_worked must be a number between 0.5 and 24' });
      continue;
    }
    const grossEarned = Number(row.gross_earned);
    if (isNaN(grossEarned) || grossEarned <= 0) {
      errors.push({ row: rowNum, message: 'gross_earned must be a positive number' });
      continue;
    }
    const platformDeductions = Number(row.platform_deductions);
    if (isNaN(platformDeductions) || platformDeductions < 0) {
      errors.push({ row: rowNum, message: 'platform_deductions must be >= 0' });
      continue;
    }
    if (platformDeductions > grossEarned) {
      errors.push({ row: rowNum, message: 'platform_deductions cannot exceed gross_earned' });
      continue;
    }
    const netReceived = Number(row.net_received);
    if (isNaN(netReceived)) {
      errors.push({ row: rowNum, message: 'net_received must be a number' });
      continue;
    }

    try {
      const platformRecord = await db.platform.upsert({
        where: { name: row.platform },
        create: {
          name: row.platform,
          slug: row.platform.toLowerCase().replace(/\s+/g, '-'),
        },
        update: {},
      });

      const shift = await db.shiftLog.create({
        data: {
          workerId,
          platformId: platformRecord.id,
          shiftDate: new Date(row.date),
          hoursWorked,
          grossEarned,
          platformDeductions,
          netReceived,
          importedViaCsv: true,
          verificationStatus: 'PENDING',
        },
      });
      created.push(shift.id);
    } catch {
      errors.push({ row: rowNum, message: 'Failed to insert row' });
    }
  }

  return c.json({ created: created.length, errors }, 201);
};
