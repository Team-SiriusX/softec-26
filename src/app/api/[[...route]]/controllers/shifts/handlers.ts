import db from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { Context } from 'hono';

import { enqueueShiftValidation } from './shift-validation-queue';

const platformSlugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizePlatformName = (name: string) =>
  name.trim().replace(/\s+/g, ' ');

const parseSafeIsoDate = (value: string): Date | null => {
  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const getPlatformCacheKey = (name: string) =>
  normalizePlatformName(name).toLowerCase();

const getPrismaIssueMessage = (error: unknown): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return 'duplicate value for a unique field';
    }

    if (error.code === 'P2003') {
      return 'foreign key constraint failed';
    }

    if (error.code === 'P2025') {
      return 'dependent record not found';
    }

    return `database request failed (${error.code})`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'database write failed';
};

type ShiftScreenshotSummary = {
  status: 'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';
  fileUrl: string;
  fileKey: string;
  verifierNotes: string | null;
  uploadedAt: Date;
};

type ShiftAiReviewSummary = {
  summary: string | null;
  reasons: string[];
  model: string | null;
  trustScore: number | null;
  confidence: number | null;
  generatedAt: string | null;
  rawNote: string | null;
};

type PersistedShiftAiReviewPayload = {
  version?: string;
  verdict?: unknown;
  trustScore?: unknown;
  confidence?: unknown;
  model?: unknown;
  summary?: unknown;
  reasons?: unknown;
  mismatches?: unknown;
  generatedAt?: unknown;
};

const withLegacyScreenshot = <T extends { screenshots: ShiftScreenshotSummary[] }>(shift: T) => ({
  ...shift,
  screenshot: shift.screenshots[0] ?? null,
});

const parseFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeReasonList = (value: unknown, max = 12): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
};

const parsePersistedAiReview = (rawNote: string): ShiftAiReviewSummary | null => {
  try {
    const parsed = JSON.parse(rawNote) as PersistedShiftAiReviewPayload;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const baseReasons = normalizeReasonList(parsed.reasons);

    const mismatchReasons = Array.isArray(parsed.mismatches)
      ? parsed.mismatches
          .filter((item): item is Record<string, unknown> => {
            return Boolean(item && typeof item === 'object');
          })
          .map((item) => {
            const field =
              typeof item.field === 'string' && item.field.trim()
                ? item.field.trim()
                : 'unknown_field';

            const claimed = parseFiniteNumber(item.claimed);
            const extracted = parseFiniteNumber(item.extracted);
            const deltaPct = parseFiniteNumber(item.deltaPct);
            const tolerancePct = parseFiniteNumber(item.tolerancePct);

            if (
              claimed === null ||
              extracted === null ||
              deltaPct === null ||
              tolerancePct === null
            ) {
              return null;
            }

            return `${field}: claimed ${claimed.toLocaleString('en-PK')} vs extracted ${extracted.toLocaleString('en-PK')} (${Math.round(deltaPct * 100)}% delta, tolerance ${Math.round(tolerancePct * 100)}%).`;
          })
          .filter((item): item is string => Boolean(item))
      : [];

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : null;

    const uniqueReasons = Array.from(new Set([...mismatchReasons, ...baseReasons])).slice(
      0,
      12,
    );

    return {
      summary,
      reasons: uniqueReasons,
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model.trim()
          : null,
      trustScore: parseFiniteNumber(parsed.trustScore),
      confidence: parseFiniteNumber(parsed.confidence),
      generatedAt:
        typeof parsed.generatedAt === 'string' && parsed.generatedAt.trim()
          ? parsed.generatedAt.trim()
          : null,
      rawNote,
    };
  } catch {
    return null;
  }
};

const parseLegacyAiReview = (rawNote: string): ShiftAiReviewSummary | null => {
  const note = rawNote.trim();
  if (!note) {
    return null;
  }

  const reasonsMatch = note.match(/Reasons:\s*([\s\S]*)$/i);
  const reasons = reasonsMatch
    ? reasonsMatch[1]
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const withoutHeader = note.replace(/^AI OCR\s+[^.]*\.\s*/i, '').trim();
  const summaryCandidate = withoutHeader
    .split(/\bDifferences:\b|\bReasons:\b/i)[0]
    ?.trim();

  const summary = summaryCandidate && summaryCandidate.length > 0 ? summaryCandidate : null;

  return {
    summary,
    reasons,
    model: null,
    trustScore: null,
    confidence: null,
    generatedAt: null,
    rawNote,
  };
};

const extractAiReviewFromScreenshots = (
  screenshots: ShiftScreenshotSummary[],
): ShiftAiReviewSummary | null => {
  const latestWithNote = screenshots.find(
    (screenshot) =>
      typeof screenshot.verifierNotes === 'string' &&
      screenshot.verifierNotes.trim().length > 0,
  );

  const note = latestWithNote?.verifierNotes?.trim();
  if (!note) {
    return null;
  }

  return parsePersistedAiReview(note) ?? parseLegacyAiReview(note);
};

const resolvePlatformId = async (
  rawPlatformName: string,
  cache?: Map<string, string>,
): Promise<string> => {
  const normalizedName = normalizePlatformName(rawPlatformName);

  if (!normalizedName) {
    throw new Error('platform is required');
  }

  const cacheKey = getPlatformCacheKey(normalizedName);

  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const existingCaseInsensitive = await db.platform.findFirst({
    where: {
      name: {
        equals: normalizedName,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (existingCaseInsensitive) {
    cache?.set(cacheKey, existingCaseInsensitive.id);
    return existingCaseInsensitive.id;
  }

  const slug = platformSlugify(normalizedName);

  if (!slug) {
    throw new Error('platform name is invalid');
  }

  const existingBySlug = await db.platform.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existingBySlug) {
    cache?.set(cacheKey, existingBySlug.id);
    return existingBySlug.id;
  }

  try {
    const created = await db.platform.create({
      data: {
        name: normalizedName,
        slug,
      },
      select: { id: true },
    });

    cache?.set(cacheKey, created.id);
    return created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const recovered = await db.platform.findFirst({
        where: {
          OR: [
            {
              name: {
                equals: normalizedName,
                mode: 'insensitive',
              },
            },
            { slug },
          ],
        },
        select: { id: true },
      });

      if (recovered) {
        cache?.set(cacheKey, recovered.id);
        return recovered.id;
      }
    }

    throw error;
  }
};

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
      ...(platform && {
        platform: {
          name: {
            contains: platform,
            mode: 'insensitive',
          },
        },
      }),
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
      screenshots: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          status: true,
          fileUrl: true,
          fileKey: true,
          verifierNotes: true,
          uploadedAt: true,
        },
      },
    },
    orderBy: { shiftDate: 'desc' },
    take: 200,
  });

  const enriched = shifts.map((s) => {
    const aiReview = extractAiReviewFromScreenshots(s.screenshots);

    return {
      ...withLegacyScreenshot(s),
      aiReview,
      effectiveHourlyRate:
        Number(s.hoursWorked) > 0
          ? Number(s.netReceived) / Number(s.hoursWorked)
          : 0,
      deductionRatePct:
        Number(s.grossEarned) > 0
          ? (Number(s.platformDeductions) / Number(s.grossEarned)) * 100
          : 0,
    };
  });

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
      screenshots: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          status: true,
          fileUrl: true,
          fileKey: true,
          verifierNotes: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!shift) return c.json({ error: 'Not found' }, 404);

  const aiReview = extractAiReviewFromScreenshots(shift.screenshots);

  return c.json({
    data: {
      ...withLegacyScreenshot(shift),
      aiReview,
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
    screenshots?: Array<{
      fileUrl: string;
      fileKey: string;
    }>;
  }>();

  const shiftDate = parseSafeIsoDate(body.shiftDate);

  if (!shiftDate) {
    return c.json({ error: 'shiftDate must be YYYY-MM-DD' }, 400);
  }

  const platformId = await resolvePlatformId(body.platform);

  const screenshots = Array.from(
    new Map((body.screenshots ?? []).map((screenshot) => [screenshot.fileKey, screenshot])).values(),
  ).slice(0, 6);

  const shift = await db.shiftLog.create({
    data: {
      workerId,
      platformId,
      shiftDate,
      hoursWorked: body.hoursWorked,
      grossEarned: body.grossEarned,
      platformDeductions: body.platformDeductions,
      netReceived: body.netReceived,
      notes: body.notes,
      verificationStatus: 'PENDING',
      ...(screenshots.length > 0
        ? {
            screenshots: {
              create: screenshots.map((screenshot) => ({
                fileUrl: screenshot.fileUrl,
                fileKey: screenshot.fileKey,
                status: 'PENDING' as const,
              })),
            },
          }
        : {}),
    },
    include: {
      platform: true,
      screenshots: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          status: true,
          fileUrl: true,
          fileKey: true,
          verifierNotes: true,
          uploadedAt: true,
        },
      },
    },
  });

  enqueueShiftValidation(shift.id);

  return c.json(
    {
      data: {
        ...withLegacyScreenshot(shift),
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
  source_row_number?: number;
  platform?: string;
  date?: string;
  hours_worked?: string | number;
  gross_earned?: string | number;
  platform_deductions?: string | number;
  net_received?: string | number;
  notes?: string;
};

export const importCsvHandler = async (c: Context) => {
  const user = c.var.user as { id: string } | undefined;
  const workerId = user?.id;
  if (!workerId) return c.json({ error: 'Unauthorized' }, 401);

  const { rows } = await c.req.json<{ rows: CsvRow[] }>();

  const created: string[] = [];
  const errors: { row: number; message: string }[] = [];
  const platformIdCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsedRowNumber = Number(row.source_row_number);
    const rowNum =
      Number.isInteger(parsedRowNumber) && parsedRowNumber > 0
        ? parsedRowNumber
        : i + 1;

    // Validate
    const platformName = normalizePlatformName(row.platform ?? '');

    if (!platformName) {
      errors.push({ row: rowNum, message: 'platform is required' });
      continue;
    }

    if (!row.date) {
      errors.push({ row: rowNum, message: 'date is required' });
      continue;
    }

    const shiftDate = parseSafeIsoDate(String(row.date));

    if (!shiftDate) {
      errors.push({ row: rowNum, message: 'date must be in YYYY-MM-DD format' });
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
      const platformId = await resolvePlatformId(platformName, platformIdCache);

      const shift = await db.shiftLog.create({
        data: {
          workerId,
          platformId,
          shiftDate,
          hoursWorked,
          grossEarned,
          platformDeductions,
          netReceived,
          notes: row.notes?.trim() || undefined,
          importedViaCsv: true,
          verificationStatus: 'PENDING',
        },
      });
      created.push(shift.id);
      enqueueShiftValidation(shift.id);
    } catch (error) {
      errors.push({
        row: rowNum,
        message: `Failed to insert row: ${getPrismaIssueMessage(error)}`,
      });
    }
  }

  return c.json({ created: created.length, errors }, 201);
};

// ─── PATCH /api/shifts/:id ───────────────────────────────────────────────────
export const updateShiftHandler = async (c: Context) => {
  const user = c.var.user as { id: string } | undefined;
  const workerId = user?.id;
  if (!workerId) return c.json({ error: 'Unauthorized' }, 401);

  return c.json(
    {
      error:
        'Shift logs are immutable. Delete the log and create a new one instead.',
    },
    405,
  );
};

// ─── DELETE /api/shifts/:id ──────────────────────────────────────────────────
export const deleteShiftHandler = async (c: Context) => {
  const user = c.var.user as { id: string } | undefined;
  const workerId = user?.id;
  if (!workerId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  const existing = await db.shiftLog.findFirst({ where: { id, workerId } });
  if (!existing) {
    return c.json({ error: 'Not found' }, 404);
  }

  await db.shiftLog.delete({ where: { id } });
  return c.json({ success: true, id });
};
